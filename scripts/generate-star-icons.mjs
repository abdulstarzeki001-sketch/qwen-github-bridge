// Build iOS and PWA icon resolutions from committed STAR neural orb PNG.
// Dependency-free PNG decode / bilinear resize / encode (Node.js).
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

const root=process.cwd(),src=path.join(root,"web","star-ai-icon.png");
const input=fs.readFileSync(src);
const pngMagic=Buffer.from([137,80,78,71,13,10,26,10]);
if(!input.subarray(0,8).equals(pngMagic))throw Error("Invalid PNG signature");
let offset=8,width=0,height=0,bitDepth=0,colorType=0,palette=null,alpha=null,compressed=[];
while(offset<input.length){
 const len=input.readUInt32BE(offset);const name=input.toString("ascii",offset+4,offset+8);
 const body=input.subarray(offset+8,offset+8+len);offset+=12+len;
 if(name==="IHDR"){width=body.readUInt32BE(0);height=body.readUInt32BE(4);bitDepth=body[8];colorType=body[9];if(body[12]!==0)throw Error("Interlaced PNG unsupported");}
 if(name==="PLTE")palette=body;
 if(name==="tRNS")alpha=body;
 if(name==="IDAT")compressed.push(body);
 if(name==="IEND")break;
}
if(width<64||height<64||width>2048||height>2048||bitDepth!==8||![2,3,6].includes(colorType))throw Error("Unexpected PNG dimensions or type");
const channels=colorType===6?4:colorType===2?3:1,bpp=channels,stride=width*bpp;
const uncompressed=zlib.inflateSync(Buffer.concat(compressed));const rgba=Buffer.alloc(width*height*4);
let pos=0,previous=Buffer.alloc(stride);
for(let y=0;y<height;y++){
 const filter=uncompressed[pos++],scan=Buffer.from(uncompressed.subarray(pos,pos+stride));pos+=stride;
 for(let x=0;x<stride;x++){
 const left=x>=bpp?scan[x-bpp]:0,up=previous[x],upleft=x>=bpp?previous[x-bpp]:0;
 if(filter===1)scan[x]=(scan[x]+left)&255;
 else if(filter===2)scan[x]=(scan[x]+up)&255;
 else if(filter===3)scan[x]=(scan[x]+Math.floor((left+up)/2))&255;
 else if(filter===4){
  const p=left+up-upleft;const a=Math.abs(p-left),b=Math.abs(p-up),c=Math.abs(p-upleft);
  scan[x]=(scan[x]+(a<=b&&a<=c?left:b<=c?up:upleft))&255;
 }else if(filter!==0)throw Error("Unexpected PNG filter");
 }
 for(let x=0;x<width;x++){
 const i=(y*width+x)*4;
 if(colorType===3){const n=scan[x];rgba[i]=palette[n*3];rgba[i+1]=palette[n*3+1];rgba[i+2]=palette[n*3+2];rgba[i+3]=alpha?.[n]??255;}
 else if(colorType===2){rgba[i]=scan[x*3];rgba[i+1]=scan[x*3+1];rgba[i+2]=scan[x*3+2];rgba[i+3]=255;}
 else {rgba[i]=scan[x*4];rgba[i+1]=scan[x*4+1];rgba[i+2]=scan[x*4+2];rgba[i+3]=scan[x*4+3];}
 }
 previous=scan;
}
const crcTable=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
function crc(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(name,data){
 const type=Buffer.from(name),length=Buffer.alloc(4),sum=Buffer.alloc(4);
 length.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([type,data])));
 return Buffer.concat([length,type,data,sum]);
}
function resize(size){
 const raw=Buffer.alloc(size*(size*4+1));
 for(let y=0;y<size;y++){
  const row=y*(size*4+1);raw[row]=0;
  for(let x=0;x<size;x++){
   const sx=(x+.5)*width/size-.5,sy=(y+.5)*height/size-.5;
   const x0=Math.max(0,Math.min(width-1,Math.floor(sx))),y0=Math.max(0,Math.min(height-1,Math.floor(sy)));
   const x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1);
   const tx=Math.max(0,Math.min(1,sx-x0)),ty=Math.max(0,Math.min(1,sy-y0));
   for(let ch=0;ch<4;ch++){
    const a=rgba[(y0*width+x0)*4+ch]*(1-tx)+rgba[(y0*width+x1)*4+ch]*tx;
    const b=rgba[(y1*width+x0)*4+ch]*(1-tx)+rgba[(y1*width+x1)*4+ch]*tx;
    raw[row+1+x*4+ch]=Math.round(a*(1-ty)+b*ty);
   }
  }
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
 return Buffer.concat([pngMagic,chunk("IHDR",header),chunk("IDAT",zlib.deflateSync(raw,{level:9})),chunk("IEND",Buffer.alloc(0))]);
}
for(const [size,name] of [[180,"apple-touch-icon.png"],[192,"icon-192.png"],[512,"icon-512.png"]]){
 const file=path.join(root,"web",name);fs.writeFileSync(file,resize(size));
 console.log("STAR PWA icon:",name,size+"x"+size,fs.statSync(file).size+" bytes");
}
