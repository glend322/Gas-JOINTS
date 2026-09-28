# Model Report — BISINDO skeleton recognizer (WL-BISINDO)

Artifacts version: `20260928-1331` · evaluation run: `demo_loso` · deployed model: `final` (all signers, 3-seed ensemble).

## What the model does
Input: MediaPipe Hand (2×21) + Pose landmarks per frame, no pixels. Output: one word of the demo vocabulary with a calibrated confidence and `accept / confirm / reject`, or `reject` for anything outside the vocabulary.

**Demo vocabulary (10 words):** Lagi (`label_05`), Maaf (`label_06`), Saya (`label_09`), Terima kasih (`label_10`), Tuli (`label_11`), Siapa (`label_13`), Di mana (`label_15`), Bagaimana (`label_17`), Datang (`label_24`), Malam (`label_31`)

Chosen for Puskesmas relevance and cross-signer reliability, avoiding pairs the 32-class model confused (Terima kasih/Kapan, Siang/Sore, Keluarga/Cari, Apa/Berangkat). The other 22 WL-BISINDO words are used as real "bukan kosakata" examples for the `none` class. Alur B (staff → video) can still show all 32 reference videos.

## Evaluation (leave-one-signer-out on signers 1–4; signer 0 = extra unseen signer)

`demo_loso`: each fold is a 3-seed ensemble, like the deployed model. Six words (Air, Hari, Apa, Kapan, Rumah, Siang) were **never** used for training in any fold, so they measure rejection of truly unseen signs. They were picked because they resemble demo words.

- Known words, unseen signer: top-1 **97.6%**, macro-F1 0.983, wrongly rejected as `none` 1.6%
- Per word F1: Malam 0.96, Lagi 0.96, Saya 0.96, Maaf 0.96, Siapa 0.99, Di mana 0.99, Terima kasih 1.00, Tuli 1.00, Bagaimana 1.00, Datang 1.00
- Most confused (true → predicted, count): Lagi→Maaf (3), Malam→Datang (2), Di mana→Terima kasih (1), Siapa→Saya (1)

History (32-class runs are for comparison; different vocabulary size):

| run | LOSO top1 | top3 | macro-F1 | s1 / s2 / s3 / s4 | signer0 top1 | AUROC none | AUROC unk. word | ECE |
|---|---|---|---|---|---|---|---|---|
| demo_loso | 0.976 | 0.998 | 0.983 | 1.000 / 0.984 / 0.940 / 0.970 | 0.960 | 0.989 | 0.928 | 0.120 |
| dtw | 0.836 | 0.936 | 0.827 | 0.943 / 0.881 / 0.644 / 0.828 | 0.802 | 0.768 | - | 0.393 |
| gru_base | 0.903 | 0.984 | 0.928 | 0.962 / 0.967 / 0.769 / 0.878 | 0.929 | 0.982 | - | 0.123 |

## Decisions (thresholds calibrated out-of-fold, unseen signers)
- Temperature 0.484 · ECE 0.120 → 0.013
- Raw thresholds: accept ≥ 0.915, confirm ≥ 0.825, centroid cosine ≥ 0.740; remapped to the kiosk's 0.85 / 0.6.
- Demo words: accept 93.8%, confirm 0.7%, reject 5.6% (accept precision 100.0%, confirm precision 100.0%)
- Unseen words (never trained): accept 35.0%, confirm 3.9%, reject 61.1%
- Other non-demo words (unseen signer): accept 0.1%, confirm 0.0%, reject 99.9%
- Non-sign movement: accept 3.3%, confirm 2.7%, reject 94.0%
  - In the deployed model all 22 non-demo WL-BISINDO words (incl. the 6 above) are trained as `none`, so they behave like the "other non-demo words" row. The "unseen words" row is the estimate for signs outside all 32 WL-BISINDO words.
- Precision of accepted results, assuming 10.0% of inputs are out-of-vocabulary signs: **97.1%**
- Extra signer 0 (demo words 0–11 only): accept 94.5%, confirm 0.5%, reject 5.0% (accept precision 100.0%, confirm precision 100.0%)
- AUROC known vs unknown_word 0.927, none 0.990, negative_word 1.000

## Integration (for the backend / frontend teams)
**Backend** — load once, call per capture:
```python
from bisindo.predict import Predictor
p = Predictor()                 # ml/artifacts/
r = p.predict_json(payload)     # dict or JSON str/bytes; raises pydantic.ValidationError / ValueError
# r = {phraseId, label, confidence, action: accept|confirm|reject, reason, topK, debug}
p.vocabulary()                  # the words the model recognizes
```
`action` already contains the calibrated PRD §10 decision (≥0.85 accept, 0.60–0.84 confirm, else reject) including out-of-vocabulary rejection; `phraseId`/`label` are null on reject. ~20–30 ms per call on CPU.

**Payload** (`ml/src/bisindo/schema.py`): `{frames: [{t_ms, hands: [{landmarks: 21×[x,y,z], handedness, score}], pose: 33×[x,y,z,visibility] | null}], mirrored, width, height}` — MediaPipe HandLandmarker (numHands 2) + PoseLandmarker (lite) normalized image coordinates, same `.task` models as in `ml/mp_models/`.

**Frontend capture rules** (otherwise accuracy drops; each was found in a browser test where headless Edge played dataset clips as the webcam, after which browser and Python pipelines agreed 26/26):
- Send landmarks of the **un-mirrored** camera frame (`mirrored: false`); mirror only the preview.
- Include pose landmarks (the model normalizes by shoulders). Send the real camera `width`/`height`.
- Start the sequence at the **first detected hand**, including the 250 ms debounce (pre-roll).
- During the debounce, tolerate a detector dropout of ~150 ms instead of treating it as a false start.
- A hand hanging at rest (wrist more than 1.35 shoulder-widths below the shoulder line) must not count as "still signing"; otherwise the capture never sees the hand leave and stops late/badly.
- Guard-rail numbers are in `ml/config/default.yaml` → `capture:`; `scripts/live_demo.py` is a reference implementation of the auto-capture state machine.

## Limitations
- Word-level WL-BISINDO vocabulary, not the full Puskesmas phrases of PRD §7.
- 5 signers, one recording setup each; a real kiosk camera/lighting has not been tested with real people. Run the PRD §21 test (5 words × 10 tries) on the actual device before demo day.
- Unseen out-of-vocabulary signs are the weakest point; the product must keep Konfirmasi/Coba Lagi/Panggil JBI.
- Dataset license was not found in the provided files; confirm before public demo or reuse of videos (Alur B).

## Framing
"Mengenali sejumlah isyarat BISINDO tingkat kata dari dataset publik WL-BISINDO, dievaluasi pada penanda tangan yang tidak pernah dilihat model."