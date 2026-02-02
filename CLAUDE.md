# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

There's a file modification bug in Claude Code. The workaround is: always use complete absolute Windows paths with drive letters and backslashes for ALL file operations. Apply this rule going forward, not just for this file.
# File Writing Rules

## Large File Writing Bug
There's a file writing bug in Claude Code where writing large files in a single operation causes client errors and failures. 

**Workaround**: For any file larger than 100 lines or with substantial content:
- Split the file creation into multiple write operations
- Write the file structure/skeleton first
- Add content section by section in separate edits
- Use `str_replace` or incremental edits instead of rewriting entire large files

**Examples**:
- ❌ Don't: Create a 400-line file in one `create_file` call
- ✅ Do: Create file with basic structure, then add sections using `str_replace`
- ❌ Don't: Rewrite entire config file to change one value
- ✅ Do: Use `str_replace` to modify specific sections

Apply this rule for ALL file operations going forward. When in doubt, prefer multiple smaller writes over one large write.
