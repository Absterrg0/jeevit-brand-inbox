# Archived run: qwen2.5:7b, local (Ollama, CPU), temperature 0

The first complete recorded run of this pipeline, kept as a model comparison. It ran
fully offline, free, at about 3 minutes per email on a shared CPU.

These files are copied unchanged from commit `035026c`:

| File | What it is |
| --- | --- |
| `eval-report.md` | The `npm run eval` report for this run: both sets, per category, per field, confusion matrices, every miss |
| `eval-results.json` | The same report as data |
| `out-analysis.json`, `out-summary.md` | The pipeline output for the supplied inbox |
| `recordings-*.json` | Every raw model response, with tokens and latency |

The local-model provider was later removed from the code to keep one supported path, so this
run cannot be replayed by the current CLI. The labels and the held-out emails are the same ones
used for the current Groq run, so the two runs compare directly. See "Same pipeline, two models"
in the top-level README.
