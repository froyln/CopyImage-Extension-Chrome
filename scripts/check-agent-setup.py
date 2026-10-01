#!/usr/bin/env python3
"""Check a copied agent template with only the Python standard library."""

import argparse
import json
from pathlib import Path
import re


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument(
        "--template", action="store_true", help="validate the source template before placeholders are filled"
    )
    args = parser.parse_args()
    root = args.root.resolve()
    errors = []

    agents = root / "AGENTS.md"
    claude = root / "CLAUDE.md"
    settings = root / ".claude/settings.json"
    for path in (agents, claude, settings):
        if not path.is_file():
            errors.append(f"missing: {path.relative_to(root)}")

    if agents.is_file() and not args.template:
        lines = agents.read_text(encoding="utf-8").splitlines()
        for number, line in enumerate(lines, 1):
            if re.search(r"<[^<>\n]+>", line):
                errors.append(f"AGENTS.md:{number}: unresolved placeholder")

    if claude.is_file() and claude.read_text(encoding="utf-8").strip() != "@AGENTS.md":
        errors.append("CLAUDE.md: keep only @AGENTS.md so all clients share AGENTS.md")

    if settings.is_file():
        try:
            config = json.loads(settings.read_text(encoding="utf-8"))
            if not isinstance(config, dict):
                errors.append(".claude/settings.json: expected a JSON object")
        except (json.JSONDecodeError, UnicodeError) as exc:
            errors.append(f".claude/settings.json: {exc}")

    if errors:
        for error in errors:
            print(error)
        return 1
    print("Agent setup is valid" if not args.template else "Source template is valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
