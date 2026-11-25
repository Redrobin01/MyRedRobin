"""Builds site/index.html for My Red Robin (the families app).
Parts: src/template.html, the Rocker's styles (src/rocker.css), the Portal screens (src/portal.js + src/portal.css,
copied from the Rocker), src/app.js and src/site.css, and src/config.json (bridge URL, version, demo).
Run: python3 build/build.py"""
import pathlib, json
root = pathlib.Path(__file__).parent.parent
src = root / "src"
cfg = json.loads((src / "config.json").read_text())
import os
if os.environ.get("RRS_API"): cfg["api"] = os.environ["RRS_API"]  # local testing only
css = "\n".join((src / f).read_text() for f in ["rocker.css", "portal.css", "site.css"])
page = (src / "template.html").read_text()
for key, val in [("/*__CSS__*/", css), ("/*__CONFIG__*/", json.dumps(cfg)),
                 ("/*__PORTAL__*/", (src / "portal.js").read_text()), ("/*__APP__*/", (src / "app.js").read_text())]:
    assert page.count(key) == 1, key
    page = page.replace(key, val.replace("</script", "<\\/script"))
out = root / "site/index.html"
out.write_text(page)
print(f"wrote {out} ({out.stat().st_size:,} bytes), version {cfg['version']}, demo={cfg['demo']}")
