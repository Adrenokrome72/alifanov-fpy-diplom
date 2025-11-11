#!/usr/bin/env python3
# collect_code_to_texts.py
# Собирает все текстовые (кодовые) файлы из backend/ и frontend/ в backend_all.txt и frontend_all.txt,
# уважая .gitignore и ряд дефолтных игнор-паттернов.

import os
import re
import sys
from pathlib import Path

ROOT = Path.cwd()
GITIGNORE = ROOT / ".gitignore"
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"

OUT_BACKEND = ROOT / "backend_all.txt"
OUT_FRONTEND = ROOT / "frontend_all.txt"

# максимальный размер файла, который будем инлайн включать (bytes)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# дефолтные игноры (дополнительно к .gitignore)
DEFAULT_IGNORES = [
    ".git/",
    "venv/",
    "env/",
    ".venv/",
    "__pycache__/",
    "*.pyc",
    "*.pyo",
    "*.egg-info/",
    "node_modules/",
    "dist/",
    "build/",
    ".DS_Store",
    "*.sqlite3",
    "*.db",
    ".pytest_cache/",
    "coverage/",
    "logs/",
    "*.log",
    ".idea/",
    ".vscode/",
]

def read_gitignore(path):
    ignores = []
    unignores = []
    if not path.exists():
        return ignores, unignores
    for raw in path.read_text(encoding='utf-8', errors='ignore').splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('!'):
            pattern = line[1:].strip()
            if pattern:
                unignores.append(pattern)
            continue
        ignores.append(line)
    return ignores, unignores

def pattern_to_regex(pat):
    """
    Convert simple .gitignore-like pattern to regex matching a forward-slash separated relative path.
    Supports:
      - ** (matches any path segments)
      - * (matches any chars except /)
      - ? (single char)
      - trailing slash indicates directory
      - leading slash anchors to repo root
    This is not a full gitignore engine but handles common cases used in project gitignores.
    """
    anchored = False
    if pat.startswith('/'):
        anchored = True
        pat = pat[1:]
    is_dir = pat.endswith('/')
    if is_dir:
        pat = pat[:-1]

    # escape regex special chars, then unescape our globs for substitution
    esc = ''
    i = 0
    while i < len(pat):
        if pat[i:i+2] == '**':
            esc += '<<<GLOBSTAR>>>'
            i += 2
        elif pat[i] == '*':
            esc += '<<<STAR>>>'
            i += 1
        elif pat[i] == '?':
            esc += '<<<Q>>>'
            i += 1
        else:
            esc += re.escape(pat[i])
            i += 1
    # replace placeholders with regex
    esc = esc.replace('<<<GLOBSTAR>>>', '.*')
    esc = esc.replace('<<<STAR>>>', '[^/]*')
    esc = esc.replace('<<<Q>>>', '.')
    if is_dir:
        # match directory path or anything under it
        regex = r'^(?:' + esc + r')(?:/.*)?$'
    else:
        regex = r'^(?:' + esc + r')$'
    if not anchored:
        # allow match anywhere in path: so check any path segment suffix/prefix
        regex = r'(^|.*/)' + esc + (r'(/.*)?$' if is_dir else r'$')
    return re.compile(regex)

def build_matchers(patterns):
    return [pattern_to_regex(p) for p in patterns]

def matches_any(path_rel, matchers):
    # path_rel is posix-like relative path
    for r in matchers:
        if r.search(path_rel):
            return True
    return False

def is_binary_file(path: Path, blocksize=4096):
    try:
        with path.open('rb') as f:
            chunk = f.read(blocksize)
            if b'\x00' in chunk:
                return True
            # heuristic: if a high fraction of bytes are non-text, treat as binary
            if not chunk:
                return False
            text_chars = bytearray({7,8,9,10,12,13,27} | set(range(0x20, 0x100)))
            nontext = sum(1 for b in chunk if b not in text_chars)
            if nontext / len(chunk) > 0.30:
                return True
    except Exception:
        return True
    return False

def should_include_file(path: Path, rel_posix: str, ignore_matchers, unignore_matchers):
    # unignore has priority
    if unignore_matchers and matches_any(rel_posix, unignore_matchers):
        return True
    if ignore_matchers and matches_any(rel_posix, ignore_matchers):
        return False
    # skip default ignores too
    for pat in DEFAULT_IGNORES:
        m = pattern_to_regex(pat)
        if m.search(rel_posix):
            return False
    # skip dot-files like .env, but not .gitignore itself if desired
    # we'll allow README, LICENSE etc — main check is binary & size
    return True

def collect_text_files(root_dir: Path, ignore_matchers, unignore_matchers):
    files = []
    if not root_dir.exists():
        return files
    for p in root_dir.rglob('*'):
        # skip directories
        if p.is_dir():
            continue
        try:
            rel = p.relative_to(ROOT).as_posix()
        except Exception:
            rel = str(p)
        # skip output files themselves if they live in repo root
        if rel in (OUT_BACKEND.name, OUT_FRONTEND.name):
            continue
        if not should_include_file(p, rel, ignore_matchers, unignore_matchers):
            continue
        # skip very large files
        try:
            if p.stat().st_size > MAX_FILE_SIZE:
                # skip huge binary or assets
                continue
        except Exception:
            continue
        # skip binaries
        if is_binary_file(p):
            continue
        files.append((p, rel))
    # sort by path for determinism
    files.sort(key=lambda x: x[1])
    return files

def write_aggregate(out_path: Path, file_list):
    out_path_parent = out_path.parent
    if not out_path_parent.exists():
        out_path_parent.mkdir(parents=True, exist_ok=True)
    with out_path.open('w', encoding='utf-8', errors='replace') as outf:
        for p, rel in file_list:
            outf.write(f"\n\n/* ===== FILE: {rel} ===== */\n\n")
            try:
                text = p.read_text(encoding='utf-8')
            except Exception:
                text = p.read_text(encoding='utf-8', errors='replace')
            outf.write(text)
    print(f"Wrote {len(file_list)} files to {out_path}")

def main():
    ignores, unignores = read_gitignore(GITIGNORE)
    ignore_matchers = build_matchers(ignores) if ignores else []
    unignore_matchers = build_matchers(unignores) if unignores else []

    print("Root:", ROOT)
    print("Using .gitignore patterns:", len(ignores), "unignore patterns:", len(unignores))

    # backend
    backend_files = collect_text_files(BACKEND_DIR, ignore_matchers, unignore_matchers)
    write_aggregate(OUT_BACKEND, backend_files)

    # frontend
    frontend_files = collect_text_files(FRONTEND_DIR, ignore_matchers, unignore_matchers)
    write_aggregate(OUT_FRONTEND, frontend_files)

    print("Done.")

if __name__ == "__main__":
    main()
