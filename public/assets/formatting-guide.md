# Policy Document Format Reference

This reference describes the complete `.md` file format used by Policy Builder. You can write files by hand, generate them with an LLM, or use the editor UI.

---

## File Structure

Every policy file is a standard Markdown file. Metadata (title, versions, page size) is stored as YAML frontmatter **wrapped inside an HTML comment** so it stays hidden when the file is viewed as plain Markdown.

```markdown
<!--
---
title: Anti-virus Policy
pageSize: Legal
versions:
  - version: '1.4'
    date: '2022-12-14'
    updatedBy: Swaroop Prashanth
  - version: '1.3'
    date: '2021-12-16'
    updatedBy: Swaroop Prashanth
  - version: '1.2'
    date: '2020-12-18'
    updatedBy: Swaroop Prashanth
  - version: '1.1'
    date: '2019-12-12'
    updatedBy: Swaroop Prashanth
  - version: '1.0'
    date: '2018-12-17'
    updatedBy: Swaroop Prashanth
---
-->

# 1. Overview

Your policy content starts here...
```

**Key points about the metadata block:**

- The entire YAML block sits inside `<!--` and `-->` HTML comment markers
- The `---` delimiters go inside the comment, not outside
- This keeps metadata invisible when the markdown is rendered normally
- The app parses the comment to extract title, versions, and settings

### Frontmatter Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `title` | Yes | — | Policy name. Appears on cover page and page headers |
| `logo` | No | Placeholder | URL to company logo image |
| `pageSize` | No | `Legal` | Page size: `Legal`, `Letter`, or `A4` |
| `versions` | No | — | Array of version entries (see below) |
| `pdfStyles` | No | — | Custom heading colors/sizes (set via UI) |

### Version Entry Format

Each version entry has three fields. Versions are listed in **descending order** (newest first):

```yaml
versions:
  - version: '1.2'           # Newest version first
    date: '2026-04-20'       # Date in YYYY-MM-DD format
    updatedBy: Jane Doe       # Person who made the update
  - version: '1.1'
    date: '2026-01-15'
    updatedBy: Jane Doe
  - version: '1.0'           # Oldest version last
    date: '2025-06-01'
    updatedBy: John Smith
```

Version numbers follow `1.0`, `1.1`, `1.2`, `1.3` ... format. Each review or update increments the minor number.

---

## Merging Multiple Policies

When multiple policy files are merged into a single `.md` file, each policy is separated by the following marker:

```html
<!-- ===POLICY-BREAK=== -->
```

The app uses this marker to split the merged file back into individual policies. Do not use `---` as a separator between policies — it conflicts with YAML frontmatter delimiters.

---

## How Headings Map to PDF Output

Headings control both the document structure and the auto-generated Table of Contents.

| Markdown | PDF Rendering | In TOC? |
|----------|--------------|---------|
| `# Title` | Large blue heading (22px, bold) | Yes |
| `## Section` | Medium blue heading (18px, semi-bold) | Yes (indented) |
| `### Sub-section` | Smaller blue heading (16px, semi-bold) | No |
| `#### Detail` | Small heading (14px, semi-bold) | No |
| `##### Minor` | Body-size heading (12px, bold) | No |

### Recommended Heading Pattern

Use numbered headings for clear document structure:

```markdown
# 1. Overview

## 1.1 Purpose

## 1.2 Scope

# 2. Policy

## 2.1 Employee Requirements

## 2.2 Data in Motion

## 2.3 Endpoints and Workstations

# 3. Enforcement
```

> **Important:** Only `#` (H1) and `##` (H2) headings appear in the Table of Contents. Use them for your main sections and sub-sections.

### Common Section Patterns

Most Gainfront policies follow one of these heading structures:

**Pattern A — Overview/Policy/Enforcement:**
```markdown
# 1. Overview
## 1.1 Purpose
## 1.2 Scope
# 2. Privacy
# 3. Policy
## 3.1 ...subsections...
# 4. Enforcement
```

**Pattern B — Direct Sections:**
```markdown
# 1. Scope
# 2. Policy Elements
## 2.1 ...subsection...
## 2.2 ...subsection...
# 3. Non-Compliance
# 4. Questions
```

---

## Text Formatting

```markdown
**Bold text**
*Italic text*
***Bold and italic***
~~Strikethrough~~
```

---

## Lists

### Bullet List

```markdown
- First item
- Second item
  - Nested item
  - Another nested
- Third item
```

### Numbered List

```markdown
1. Step one
2. Step two
3. Step three
```

---

## Tables

```markdown
| Column A | Column B | Column C |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

Tables render with borders, grey header row, and full width in the PDF.

---

## Other Elements

### Blockquotes

```markdown
> This is a callout or note.
> It can span multiple lines.
```

### Code

Inline: `` `code here` ``

Block:
````markdown
```
function example() {
  return "hello";
}
```
````

### Links and Images

```markdown
[Link text](https://example.com)
![Image alt text](https://example.com/image.png)
```

### Horizontal Rule

```markdown
---
```

---

## PDF Output Structure

When exported, the PDF contains these pages in order:

1. **Cover Page** — Logo (centered), policy title, latest version number and date
2. **Table of Contents** — Auto-generated from H1 and H2 headings, with header and footer
3. **Content Pages** — Your rendered markdown, with header on first page. Flows across multiple pages naturally
4. **Version History** — Table of all version entries with header

### What Appears Where

| Element | Cover | TOC | Content | Version History |
|---------|-------|-----|---------|-----------------|
| Logo | Center (large) | Header (small) | Header (small) | Header (small) |
| Title | Center (large) | Header text | Header text | Header text |
| Version | Below title | Footer | — | — |
| Page No. | — | Footer | — | — |

---

## Complete Example File

```markdown
<!--
---
title: Data Loss Prevention Policy
pageSize: Legal
versions:
  - version: '1.4'
    date: '2022-12-17'
    updatedBy: Swaroop Prashanth
  - version: '1.3'
    date: '2021-12-16'
    updatedBy: Swaroop Prashanth
  - version: '1.2'
    date: '2020-12-18'
    updatedBy: Swaroop Prashanth
  - version: '1.1'
    date: '2019-12-12'
    updatedBy: Swaroop Prashanth
  - version: '1.0'
    date: '2018-12-17'
    updatedBy: Swaroop Prashanth
---
-->

# 1. Overview

Data Loss Prevention (DLP) is a set of technologies and business
policies to make sure end-users do not send sensitive or confidential
data outside the organization without proper authorization.

## 1.1 Purpose

The purpose of this document is to protect restricted, confidential,
or sensitive data from loss to avoid reputation damage and to avoid
adversely impacting its customers.

## 1.2 Scope

This policy applies to all employees, interns, contractors,
consultants, and temporary employees.

# 2. Privacy

The Data Loss Prevention Policy document shall be considered as
"confidential" and shall be made available to the concerned persons
with proper access control.

# 3. Policy

## 3.1 Employee Requirements

1. All employees must complete security awareness training
2. Visitors must be escorted by an authorized employee at all times
3. Use a secure password on all systems as per the password policy

## 3.2 Data in Motion

- DLP solution will be configured at endpoints to identify data in motion
- DLP will scan for data in motion and identify specific content
- DLP will log incidents centrally for review

## 3.3 Endpoints and Workstations

1. All devices in scope will have full-disk encryption enabled
2. Encryption policy must be managed and compliance validated

| Requirement | Details |
|-------------|---------|
| Full-disk encryption | All devices in scope |
| AUP training | Required for all users |
| Lost device reporting | Immediate notification |

> **Note:** All security-related events will be logged and audited
> to identify inappropriate access or malicious use.

# 4. Enforcement

Any employee found to have violated this policy may be subjected
to disciplinary action in line with the HR Policy.
```

---

## Tips

- Keep `#` H1 headings for major numbered sections
- Keep `##` H2 headings for sub-sections — both appear in TOC
- Use `###` H3 and below for details that don't need TOC entries
- Add version entries each time the policy is updated (newest first)
- Version numbers increment as `1.0`, `1.1`, `1.2`, etc.
- Set page size before exporting (Legal is recommended for policies)
- Customize heading colors and font family in PDF Export Styles
- Wrap frontmatter in `<!-- -->` HTML comments
- Use `<!-- ===POLICY-BREAK=== -->` to separate policies in merged files
