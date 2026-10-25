# OrtaLama / Borealis-inspired interface

## Reference and capture

Direction supplied by the user: [Borealis Carbon, by Phenomenon Labs / Phenomenon Studio](https://dribbble.com/shots/27761200-Website-Design-for-Carbon-Technology-Borealis-Carbon).
Inspected in the browser on 24 October 2026, including the animated overview and
four desktop/mobile presentation images. Firecrawl retrieval was unavailable
because the connected account had no credits; the artwork was inspected directly.

Reference images:
- [Global carbon intelligence](https://cdn.dribbble.com/userupload/49134620/file/1390b3ccf8c1c07635dabc6214f555fb.png)
- [Mobile field record](https://cdn.dribbble.com/userupload/49134621/file/22a08f4ce2fc9c714ca1af76a7abbfec.png)
- [Metrics and panels](https://cdn.dribbble.com/userupload/49134619/file/a1e5e91f1703031541ba7da9c00778d5.png)
- [Data pipeline](https://cdn.dribbble.com/userupload/49134622/file/70dcf1f23a7b95ecdbf183eba597996c.png)

## Observed visual system

Near-black canvas, cool charcoal/slate surfaces, pale cyan highlights, fine gray
rules, subdued industrial photographs, white rectangular buttons, restrained sans
serif headings, technical micro-labels, and occasional small triangular notches
in panel edges. The Dribbble page exposes palette values #07080A, #423F3F,
#283B4F, #30495F, #F4F8FA, #9DA5AC, and #509498. These are palette evidence,
not extracted original CSS. Spacing, font family, and breakpoint values were not
available from the artwork; all implementation values below are adaptations.

## Implementation tokens

| Role | Value | Use |
| --- | --- | --- |
| Canvas | #0b0e10 | Main background |
| Header / rail | #0d1114 | Application shell |
| Panel | #14191d | Forms, cohorts, tables |
| Raised slate | #1d252b | Results, calculator, secondary panels |
| Text | #f4f8fa | Headings and primary content |
| Secondary text | #a6b0b8 | Body copy and descriptive labels |
| Cyan | #a2d6db | Links, focus indicators, selected controls |
| Deep cyan | #509498 | Rules and quiet accents |
| Divider | #30393f | Structural hairlines |
| Success | #a4d5be | Verified/pass text paired with labels |
| Error | #f4ab9f | Failure text paired with labels |

Keep the existing self-hosted Barlow regular/semibold and OrtaLama Register Mono
fonts, including their existing licenses and swap behavior. Barlow's industrial
character fits the reference while preserving Turkish glyph coverage. Large
headings use regular weight and tight spacing. Monospaced type stays limited to
hashes, numbers, and technical metadata. Reference micro-labels are used sparingly
on the opening page, rather than added to every working form.

## Composition and project adaptation

Retain the application's navigation destinations and React pages. The new header
adds an abstract folded commitment mark, the existing simulation label, the
existing language toggle, and a shortcut to the live workspace. The desktop rail
retains all eight destinations; the mobile menu retains the existing explicit
open/close control and expanded state. Breadcrumb-style context is present above
each page. Trustee nodes share the active navigation state.

The home page opens with a cinematic industrial photograph and its original
headline, introduction, and actions. A presentation-only strip explains the real
protocol sequence. The cohort and aggregate use the original queries and retain
loading, empty, and error states. No illustrative number or image is chain data.
The existing sourced comparison is presented beside a second industrial image.
The original limitations and three explanatory sections remain available.

All working pages inherit dark form surfaces, contrasting input borders, fine
rules, and shared button styling. Verification, trustees, report review, attack
controls, calculator, round evidence, dossier, badge, and source-register views
keep their existing controls, handlers, worker calls, and data sources. Closed
cohort glyphs continue to derive from actual commitments. QR codes retain their
white backgrounds and original generated data. Result panels receive a small
reference-inspired edge notch without clipping or hiding content.

Desktop: 228px rail and a flexible work surface. At 1200px the rail narrows to
204px. At 1000px the cohort/result instrument stacks. At 760px the rail becomes
an explicit menu, hero and forms fit a single column, tables scroll inside their
containers, and the header keeps its language and simulation controls. At 380px
cohorts use three columns. Focus indicators and reduced motion are preserved.
These are implementation choices; reference artwork does not establish its
original responsive behavior or keyboard interactions.

## Photography

Both photographs are downloaded into public/images, so runtime rendering does not
contact an image service. Decorative images use empty alt text and do not imply
that the photographed facilities participate in OrtaLama.

- `industrial-plant.jpg`: [Unsplash industrial facility photograph](https://images.unsplash.com/photo-1516937941344-00b4e0337589), used in the hero with a desaturated treatment and dark overlays.
- `industrial-pipelines.jpg`: [Unsplash industrial piping photograph](https://images.unsplash.com/photo-1513828583688-c52646db42da), used in the sourced comparison section.
- Source provider: [Unsplash license](https://unsplash.com/license).

The reference's original photography, proprietary typeface, and globe assets are
not bundled. This is an adaptation of its aesthetic to the existing product,
not a pixel reconstruction of the unrelated marketing page.

## Local validation

The production build and frontend TypeScript checks pass. The existing real
five-browser workflow regression passed against an isolated synthetic local stack:
round 3 published 900000 ppm, an independent phone browser recomputed it, a valid
threshold badge was issued, and the above-average witness was rejected. The gate
also covered recovery after lost broadcast/share responses and a retried public
co-signature, with no private fields on public requests and no page errors.

Responsive interaction checks passed 36 route/viewport combinations at 320, 390,
760, 1024, 1440, and 1920px in English and Turkish. These included language
persistence, mobile menu expansion/collapse, the keyboard skip link, calculator
recalculation and invalid-input handling, and no horizontal overflow.

These checks validate the local application; they do not establish production
security, regulatory acceptance, or the behavior of a separately deployed site.

The final accessibility audit passed all 52 route/size/language combinations,
including the completed browser verification screen, with zero automated WCAG
violations, zero horizontal overflow, and zero page errors. Automated checks
supplement visual inspection and are not a claim of complete WCAG conformance.
