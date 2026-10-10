import re

with open("frontend/app.js", "r", encoding="utf-8") as f:
    code = f.read()

# Replacements to sanitize dynamically inserted variables
replacements = [
    (r"\$\{rep\.summary\}", r"${escapeHTML(rep.summary)}"),
    (r"\$\{rep\.remaining_uncertainty\}", r"${escapeHTML(rep.remaining_uncertainty)}"),
    (r"\$\{rep\.model_identifier\}", r"${escapeHTML(rep.model_identifier)}"),
    (r"\$\{rep\.retrieval_mode\}", r"${escapeHTML(rep.retrieval_mode)}"),
    (r"\$\{rep\.status\}", r"${escapeHTML(rep.status)}"),
    
    (r"\$\{r\.title\}", r"${escapeHTML(r.title)}"),
    (r"\$\{r\.heading\}", r"${escapeHTML(r.heading)}"),
    (r"\$\{r\.text\.substring\(0, 200\)\}", r"${escapeHTML(r.text.substring(0, 200))}"),
    (r"\$\{r\.method\}", r"${escapeHTML(r.method)}"),
    
    (r"\$\{c\.service\}", r"${escapeHTML(c.service)}"),
    (r"\$\{c\.evidence\.join\(' '\)\}", r"${escapeHTML(c.evidence.join(' '))}"),
    
    (r"\$\{inc\.id\}", r"${escapeHTML(inc.id)}"),
    (r"\$\{inc\.status\}", r"${escapeHTML(inc.status)}"),
    (r"\$\{inc\.severity\}", r"${escapeHTML(inc.severity)}"),
    
    (r"\$\{e\.message\}", r"${escapeHTML(e.message)}"),
    (r"\$\{err\.message\}", r"${escapeHTML(err.message)}"),
]

for pattern, repl in replacements:
    code = re.sub(pattern, repl, code)

with open("frontend/app.js", "w", encoding="utf-8") as f:
    f.write(code)
