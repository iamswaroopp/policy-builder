# Policy Document Format Reference

This reference describes the complete `.md` file format used by Policy Builder. You can write files by hand, generate them with an LLM, or use the editor UI.

---

## File Structure

Every policy file is a standard Markdown file with an optional YAML frontmatter block at the top:

```
---
title: Information Security Policy
logo: https://example.com/logo.png
pageSize: Legal
versions:
  - version: '1.0'
    date: '2026-01-15'
    updatedBy: John Smith
  - version: '1.1'
    date: '2026-04-20'
    updatedBy: Jane Doe
---

Your markdown content starts here...
```

### Frontmatter Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `title` | Yes | — | Policy name. Appears on cover page and page headers |
| `logo` | No | Placeholder | URL to company logo image |
| `pageSize` | No | `Legal` | Page size: `Legal`, `Letter`, or `A4` |
| `versions` | No | — | Array of version entries (see below) |
| `pdfStyles` | No | — | Custom heading colors/sizes (set via UI) |

### Version Entry Format

Each version entry has three fields:

```yaml
versions:
  - version: '1.0'        # Version number (string)
    date: '2026-01-15'    # Date in YYYY-MM-DD format
    updatedBy: John Smith  # Person who made the update
```

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
# 1. Access Control Policy

## 1.1 User Access Management

All users must be assigned a unique identifier...

### 1.1.1 Password Requirements

- Minimum 14 characters
- Changed every 90 days

## 1.2 Network Access Control

Connections to external networks shall be controlled...

# 2. Data Classification

## 2.1 Classification Levels

...
```

> **Important:** Only `#` (H1) and `##` (H2) headings appear in the Table of Contents. Use them for your main sections and sub-sections.

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
---
title: Acceptable Use Policy
logo: https://company.com/logo.png
pageSize: Legal
versions:
  - version: '1.0'
    date: '2026-01-10'
    updatedBy: Security Team
  - version: '1.1'
    date: '2026-04-15'
    updatedBy: Compliance Officer
---

# 1. Purpose

This policy defines acceptable use of company IT resources
to protect the organization and its employees.

## 1.1 Scope

This policy applies to all employees, contractors, and
third-party users who access company systems.

## 1.2 Definitions

| Term | Definition |
|------|-----------|
| PII | Personally Identifiable Information |
| MFA | Multi-Factor Authentication |

# 2. General Usage

## 2.1 Authorized Use

Company IT resources are provided for business purposes.
Limited personal use is permitted if it:

- Does not interfere with work duties
- Does not consume excessive resources
- Complies with all other company policies

## 2.2 Prohibited Activities

The following activities are strictly prohibited:

1. Sharing credentials or passwords
2. Installing unauthorized software
3. Accessing inappropriate content
4. Attempting to bypass security controls

### 2.2.1 Email and Communications

> **Note:** All company email is subject to monitoring
> and may be reviewed for compliance purposes.

- Do not open suspicious attachments
- Report phishing attempts immediately
- Use encryption for sensitive data

# 3. Enforcement

Violations may result in disciplinary action up to
and including termination of employment.

## 3.1 Reporting

Report violations to **security@company.com** or
through the internal reporting portal.
```

---

## Tips

- Keep `#` H1 headings for major numbered sections
- Keep `##` H2 headings for sub-sections — both appear in TOC
- Use `###` H3 and below for details that don't need TOC entries
- Add version entries each time the policy is updated
- Set page size before exporting (Legal is recommended for policies)
- Customize heading colors and font family in PDF Export Styles
