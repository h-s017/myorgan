# HANA Organ Architecture

## 1. Single source of truth

`h-s017/myorgan` is the master source for:

- CW / KPIA 80 material identities
- IFRA category limits and document status
- material CAS / INCI and compliance notes
- percentage basis and safety interpretation
- future Taiwan compliance fields
- Hana's private material notes and development records

The master safety data file is:

`myorgan/safety-data.js`

## 2. Two interfaces

### Master interface — My Organ

Repository: `h-s017/myorgan`

Purpose:
- Hana's internal formula development
- complete material library
- private smelling notes / advisor notes
- advanced records, backups and internal data
- master compliance and safety data

### Student interface — Production Organ

Production URL: `https://hanascent.com/organ/`

Source repository: `h-s017/official_site`, directory `/organ/`

Purpose:
- CW / KPIA 80 teaching materials
- student-created custom single molecules
- formula weight and concentration calculation
- IFRA 51st preliminary screening
- formula export / submission

Student-created materials that do not match the master safety database must remain in a review state. Unknown data must never be treated as compliant.

## 3. Student portal

`https://hanascent.com/student-tools/` is the authenticated entry point.

It links students to:
- course material
- the production Organ at `/organ/`
- student material services

It is not a separate Organ codebase.

## 4. Compatibility repository

`h-s017/hana-scent-organ` is retained only as a compatibility entry for old bookmarks / GitHub Pages links.

It must redirect to `https://hanascent.com/organ/` and must not maintain an independent copy of the Organ logic.

## 5. Public vs private fields

Student-safe fields:
- English / Chinese material name
- material type and odor family
- CAS / INCI when appropriate
- dilution concentration
- formula amount and w/w percentage
- IFRA category result
- public compliance note / document status
- student's own smelling notes

Master-only fields:
- supplier cost and commercial terms
- private supplier records
- Hana's development formulas
- unpublished internal notes
- private advisor / client records
- non-public project metadata

## 6. Safety rule

IFRA status is a preliminary screening, not a finished-product compliance certificate.

If a material is:
- missing from master data,
- missing its required document,
- user-entered,
- or has no limit for the selected category,

the student interface must show **待複核 / 資料不足**, never **安全 / 通過**.

## 7. Sync policy

The production student Organ mirrors `myorgan/safety-data.js`.

A GitHub Action in `official_site` periodically pulls the master safety file and commits changes only when the file differs.

Formula UI code can differ between Master and Student interfaces, but safety interpretation, material identity, IFRA category definitions and percentage basis must remain consistent.
