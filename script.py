#!/usr/bin/env python3
"""
tools/dump_project_texts.py

Dump text files of the project into single text file, obeying .gitignore.

This fixed version DOES NOT auto-exclude the leading segment of gitignore
patterns (that caused excluding whole 'backend' when pattern was 'backend/.../').
It checks each file/directory path against .gitignore patterns precisely.

Usage:
  python3 tools/dump_project_texts.py -v
  python3 tools/dump_project_texts.py --dry-run -v
  python3 tools/dump_project_texts.py --out /tmp/mydump.txt
"""

import argparse
import os
import fnmatch
from pathlib import Path
import sys
import datetime

# quick skip by extension
BINARY_EXT = {
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.exe',
    '.tar', '.gz', '.mp4', '.mov', '.class', '.so', '.dll', '.woff', '.woff2',
    '.eot', '.ttf', '.otf', '.db', '.bin'
}

# Always-skip directories (explicit)
BASE_EXCLUDE_DIRS = {
    '.git', '.venv', 'venv', 'node_modules', 'dist', 'build', '__pycache__',
    '.pytest_cache', '.idea', '.vscode'
}

def find_repo_root(start: Path) -> Path | None:
    p = start.resolve()
    for _ in range(0, 50):
        if (p / '.git').exists() or (p / '.gitignore').exists():
            return p
        if p.parent == p:
            break
        p = p.parent
    return None

def read_gitignore(path: Path):
    patterns = []
    if not path.exists():
        return patterns
    try:
        for line in path.read_text(encoding='utf-8', errors='ignore').splitlines():
            s = line.strip()
            if not s or s.startswith('#'):
                continue
            if s.startswith('!'):
                # negative patterns (re-includes) are not supported in this simple tool
                continue
            patterns.append(s)
    except Exception:
        pass
    return patterns

def path_matches_pattern(rel_posix: str, pattern: str) -> bool:
    """
    Match rel_posix (path relative to repo root, posix style) against gitignore pattern.
    - Supports directory patterns ending with '/'
    - Supports patterns with slashes and globs
    - Patterns without slashes are matched against basename and path segments
    Note: does NOT support negation '!' patterns.
    """
    p = pattern.strip()
    # directory pattern
    if p.endswith('/'):
        pp = p.lstrip('/')
        # if the file/dir path equals the pattern root or is inside it
        if rel_posix == pp.rstrip('/'):
            return True
        if rel_posix.startswith(pp):
            return True
        return False

    # pattern contains slash -> treat as relative glob from root
    if '/' in p:
        p_norm = p.lstrip('/')
        return fnmatch.fnmatch(rel_posix, p_norm)

    # pattern without slash: match basename or any segment
    base = os.path.basename(rel_posix)
    if fnmatch.fnmatch(base, p):
        return True
    # match any path segment
    parts = rel_posix.split('/')
    for part in parts:
        if fnmatch.fnmatch(part, p):
            return True
    return False

def is_binary_file(path: Path):
    if path.suffix.lower() in BINARY_EXT:
        return True
    try:
        with path.open('rb') as f:
            sample = f.read(4096)
            if not sample:
                return False
            try:
                sample.decode('utf-8')
                return False
            except Exception:
                return True
    except Exception:
        return True

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', '-o', default=None, help='Output file (default: <repo-root>/project_text_dump.txt)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--dry-run', action='store_true', help="Don't write file, just report")
    args = parser.parse_args()

    start = Path.cwd()
    repo_root = find_repo_root(start) or start
    gitignore_path = repo_root / '.gitignore'
    patterns = read_gitignore(gitignore_path)

    out_path = Path(args.out) if args.out else repo_root / 'project_text_dump.txt'
    if args.verbose:
        print(f"[INFO] Start dir: {start}")
        print(f"[INFO] Repo root: {repo_root}")
        print(f"[INFO] .gitignore: {gitignore_path if gitignore_path.exists() else '(not found)'}")
        print(f"[INFO] Output: {out_path}")
        print(f"[INFO] Loaded patterns: {len(patterns)}")

    total_files = 0
    written_files = 0
    skipped_ignored = 0
    skipped_binary = 0
    errors = 0

    if args.dry_run:
        print("[INFO] Dry run (no output will be written)")

    outf = None
    if not args.dry_run:
        try:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            outf = out_path.open('w', encoding='utf-8')
            outf.write(f"Project text dump\nGenerated: {datetime.datetime.utcnow().isoformat()}Z\nRepo root: {repo_root}\n\n")
        except Exception as e:
            print(f"[ERROR] Cannot open output file {out_path}: {e}")
            sys.exit(2)

    # Walk repo_root (do not auto-prune by first pattern segment)
    for dirpath, dirnames, filenames in os.walk(repo_root):
        dir_rel = os.path.relpath(dirpath, repo_root)
        if dir_rel == '.':
            dir_rel = ''
        # prune directories by explicit BASE_EXCLUDE_DIRS or by matching patterns
        new_dirnames = []
        for d in dirnames:
            # skip always-excluded directories quickly
            if d in BASE_EXCLUDE_DIRS:
                if args.verbose:
                    print(f"[SKIP-DIR] base exclude {os.path.join(dir_rel, d)}")
                continue
            candidate = os.path.join(dir_rel, d).lstrip('./').replace(os.sep, '/')
            skip = False
            # check gitignore patterns against candidate directory path
            for pat in patterns:
                if path_matches_pattern(candidate + '/', pat if pat.endswith('/') else pat):
                    skip = True
                    if args.verbose:
                        print(f"[SKIP-DIR] pattern '{pat}' matches {candidate}/")
                    break
            if not skip:
                new_dirnames.append(d)
        dirnames[:] = new_dirnames

        for fn in filenames:
            total_files += 1
            full = Path(dirpath) / fn
            rel = os.path.relpath(full, repo_root).replace(os.sep, '/')

            # skip the output file itself
            try:
                if str(full.resolve()) == str(out_path.resolve()):
                    if args.verbose:
                        print(f"[SKIP] skipping output file itself: {rel}")
                    continue
            except Exception:
                pass

            # check .gitignore patterns for the file path
            ignored = False
            for pat in patterns:
                if path_matches_pattern(rel, pat):
                    skipped_ignored += 1
                    ignored = True
                    if args.verbose:
                        print(f"[SKIP] .gitignore '{pat}' -> {rel}")
                    break
            if ignored:
                continue

            # common system files
            if fn in {'.DS_Store', 'Thumbs.db'}:
                skipped_ignored += 1
                if args.verbose:
                    print(f"[SKIP] system file {rel}")
                continue

            # extension check
            if full.suffix.lower() in BINARY_EXT:
                skipped_binary += 1
                if args.verbose:
                    print(f"[SKIP-BINARY] ext {full.suffix} -> {rel}")
                continue

            # binary heuristic
            try:
                if is_binary_file(full):
                    skipped_binary += 1
                    if args.verbose:
                        print(f"[SKIP-BINARY] binary detect -> {rel}")
                    continue
            except Exception as e:
                errors += 1
                if args.verbose:
                    print(f"[ERROR] binary check {rel}: {e}")
                continue

            # read and write
            try:
                text = full.read_text(encoding='utf-8', errors='replace')
            except Exception as e:
                errors += 1
                if args.verbose:
                    print(f"[ERROR] read {rel}: {e}")
                continue

            if not args.dry_run and outf is not None:
                try:
                    outf.write(f"--- {rel}:\n")
                    outf.write(text)
                    outf.write("\n\n")
                except Exception as e:
                    errors += 1
                    if args.verbose:
                        print(f"[ERROR] write {rel}: {e}")
                    continue
            written_files += 1
            if args.verbose:
                print(f"[WRITE] {rel}")

    if outf:
        outf.close()

    print("\n=== Summary ===")
    print(f"Repo root: {repo_root}")
    print(f"Total files scanned: {total_files}")
    print(f"Files written: {written_files}")
    print(f"Skipped by .gitignore/fs rules: {skipped_ignored}")
    print(f"Skipped as binary: {skipped_binary}")
    print(f"Errors: {errors}")
    print(f"Output: {out_path if not args.dry_run else '(dry-run)'}")

if __name__ == '__main__':
    main()
