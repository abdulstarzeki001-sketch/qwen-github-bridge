# Local secret scan

Run this read-only scanner before pushing code:

```sh
python3 scripts/secret-scan.py .
```

It checks tracked and untracked text files in the directory for common provider tokens, private-key headers, and likely hard-coded credential assignments. It skips common generated/dependency folders, symlinks, known binary extensions, files larger than 2 MiB, and the downloaded upstream source cache.

A finding reports the path, line, category, and a stable identifier. **It never prints the matched value and never sends files over the network.** Exit codes: `0` no findings, `1` findings need review, `2` invalid scan path. Use `--json` for a redacted machine-readable report.

The scanner is a best-effort guard, not proof that a repository is secret-free. Review results locally, rotate any credential that was committed, and use provider secret storage. It intentionally does not scan binary files or oversized files.