LEGEND OF ELDORIA — Prototype 0.2.3
บันทึกการดำเนินงานและสถานะการตรวจ
====================================

ขอบเขต
------
จัดชุด Static Site สำหรับอัปโหลด GitHub Pages โดยไม่เปลี่ยนกติกาการ์ด/มอนสเตอร์/การต่อสู้เดิม

งานที่ทำในรอบ 0.2.3
-------------------
1. เพิ่มเมนูในหน้า World และ Battle
2. เพิ่ม Resume และ Save & Return to Title; persist ต้องสำเร็จก่อนกลับหน้า Title
3. แก้กรณี Continue จากเซฟที่มี Pending Reward: หาก claim/commit ไม่สำเร็จ ให้เข้า Save Lock แทนการเล่นต่อ
4. เพิ่ม UI contract tests 4 กรณี
5. ปรับ verification scripts ให้รองรับการรันจาก repository root โดยตรง
6. จัดโครงสร้าง ZIP ให้ index.html อยู่ที่ root พร้อม css/, js/, assets/ และ verification/
7. สร้าง SHA256SUMS.txt สำหรับตรวจไฟล์

ผลทดสอบจากแพ็กเกจ GitHub-ready
--------------------------------
- Save Unit/Fuzz/Review/Transaction: 223 passed, 0 failed
- World + UI integration: 7 passed, 0 failed
- Regression: 0.2 values + 350 seeded battles identical to 0.1 baseline
- Mutation: 26/26 caught
- JavaScript syntax: passed
- SHA-256: all entries passed
- ZIP integrity: passed
- Browser automation: SKIP — Playwright not installed

การใช้งาน
---------
อัปโหลดเนื้อหาภายใน ZIP ไปยัง Repository Root โดยตรง (ไม่ต้องสร้างโฟลเดอร์ซ้อน)
ดู README.md และ DEPLOY_TO_GITHUB_TH.txt

ข้อจำกัด
--------
- ยังไม่ได้ยืนยันการทำงานบน Safari iPhone / Chrome PC จริง
- Save เป็น localStorage ของ Browser นั้น ไม่ใช่ Cloud Save
- การทดสอบ Browser automation ถูก SKIP ไม่ควรตีความว่า Browser runtime ผ่าน

ผลตรวจ Reliability & Compatibility — 8 พฤศจิกายน 2026
------------------------------------------------------
- Mobile Test Checklist: ผู้ใช้ยืนยันว่าผ่านครบทุกข้อบนอุปกรณ์ iPhone
- GitHub Actions: เพิ่ม full-regression-suite และ browser-smoke แยกจาก syntax-and-structure
- Full regression suite: ผ่าน (unit, integration, regression และ mutation)
- Browser smoke: ผ่านบน Chromium ทั้ง Desktop viewport และ iPhone-sized viewport
- Browser Save test: ผ่านการตรวจ localStorage หลัง reload จริงใน Chromium
- Existing Prototype 0.1 regression baseline: ผ่านจาก workflow ตรวจสอบ
- PR #13: merged เข้า main แล้ว (CI-only; ไม่เปลี่ยน gameplay, balance หรือ save schema)

ข้อจำกัดที่ยังคงอยู่
--------------------
- Browser test บน iPhone-sized viewport เป็น Chromium emulation ไม่ใช่ Safari iOS จริง
- การทดสอบ Mobile Checklist บนอุปกรณ์ iPhone เป็นผลยืนยันจากผู้ใช้ ไม่ใช่ผลที่ CI ทำแทน
- Save ยังคงเป็น localStorage แยกตาม browser/device; ยังไม่มี Cloud Save หรือการ sync ข้ามอุปกรณ์
- การตรวจ Save Recovery แบบจำลองความเสียหาย/การหยุดระหว่างเขียนยังอาศัย automated test suite; ไม่ได้ทดสอบการสูญเสียข้อมูลจริงบนอุปกรณ์ผู้ใช้

สถานะ
------
Prototype 0.2.3 gameplay ยังคงเดิม; Reliability CI hardening merged.
ไม่เปลี่ยนกติกาเกม, card balance, monster balance, save schema หรือข้อมูลเซฟผู้เล่น


Prototype 0.3 — Expanded Greenvale Capital (PR in review)
----------------------------------------------------------
- Greenvale Village expanded from 12x12 to 40x40 (1,600 tiles), retaining the existing map ID and original playable footprint for save compatibility.
- Added named districts: Old Village, Central Plaza, North Residential, West Market, Riverside Inn, Crafting Quarter, Adventurers Guild and Eastern Forest Gate.
- Added a connected road network, river crossing, pond, grove areas, building footprints and a Whispering Forest exit at the eastern gate.
- Added deterministic map generation and viewport-based tile/object culling so the larger map does not require drawing the entire world every frame.
- Kept Whispering Forest data, combat, monster balance, card rules and save schema unchanged.
- Existing Greenvale start tile remains (5,5); old interior tile coordinates are preserved.
- Automated validation and mobile/desktop browser smoke tests are required before merge.


Port Card Acquisition Foundation — 10 พฤศจิกายน 2026
------------------------------------------------------
เป้าหมาย
- นำงาน Card Acquisition จาก PR #23 เดิมมา Port ใหม่บน main หลัง PR #29 โดยรักษา Save Engine และกฎเกมที่ยืนยันแล้ว

การตรวจ PR #23 เดิม
- พบว่ามีแนวคิด Card Drop, rarity/chance independence, duplicate stacking และ idempotent reward ที่นำกลับมาใช้ได้
- พบว่า PR #23 เดิมแก้ `js/save.js` และพึ่งฐาน PR #20 ที่เป็น Save Engine รุ่นเก่า จึงไม่ปลอดภัยที่จะ Merge โดยตรง
- PR #23 เดิมยังคงเปิด Draft และไม่ได้ถูกแก้ไขหรือ Merge

การดำเนินงาน Port
- สร้าง branch `port/card-acquisition-current-save-engine` จาก main commit `c79744071f9b6ea78b3f21b669aaeaffae4633a9` (Merge PR #29)
- เพิ่ม `js/card-acquisition.js` และโหลดก่อน Save Engine / Card Collection
- ขยาย Card Collection Sidecar เป็น schema v2 เพิ่ม pending card reward และ claimed receipt; v1 ยังอ่านได้และไม่ migrate จนกว่าจะมีการเขียน
- Reward flow: stage การ์ดใน sidecar -> commit pending reward ผ่าน Save Engine เดิม -> claim การ์ดพร้อม receipt แบบ atomic -> claim EXP/item ผ่าน Save Engine
- Retry ใช้ reward sequence เดิมและตรวจ lastClaimedSeq เพื่อป้องกันการแจกซ้ำ
- เพิ่ม browser smoke ที่ใช้ test-only fixture ทดสอบ card acquisition ผ่านการต่อสู้จริง; live game tables ยังคงว่าง
- เพิ่มเอกสาร `docs/CARD-ACQUISITION-FOUNDATION.md`

Save Compatibility
- `js/save.js` blob SHA ยังคง `41717dcf41cfd9b967d8e57843a456c92bbf73d5` ตรงกับ main
- Save Schema ยังคง v1; Main/Backup/Guard, recovery, transaction/resume และ reward sequence contract ไม่เปลี่ยน
- ไม่เปลี่ยน `data.js`, `battle.js`, `world.js`, Gold, EXP, item drops หรือ balance
- ไม่มี Monster Special Skill Card identity หรือ numeric drop rate ใหม่ใน live content

Validation — PR #30 head 5a17d75
- Syntax/Structure: passed
- Unit: 245 passed, 0 failed
- Integration/UI: 30 passed, 0 failed
- World/UI: 14 passed, 0 failed
- Monster Spawn: 6 passed, 0 failed
- Regression: original 0.1 rules/cards/Poring data + 350 seeded battles unchanged
- Mutation: 26/26 caught
- Browser: real localStorage reload + desktop/iPhone-sized Chromium passed; pageErrors = []
- GitHub Actions: Validate Prototype run 42736230135 และ Full Verification run 42736230131 ผ่าน

สถานะปัจจุบัน
- PR #30: https://github.com/kasipong13-boop/legend-of-eldoria/pull/30
- State: Open / Draft / Mergeable / Not merged
- Base: main; ahead 21 commits, behind 0
- รอ Final Review และการอนุมัติ Merge จาก Game Owner



PR #30 — TDR-030 Remediation (10 พฤศจิกายน 2026)
--------------------------------------------------
การตัดสินใจจาก Game Owner
- Companion Journal Storage: IndexedDB (ตัวเลือก B)
- Multi-tab Lock: Web Locks API + Fail-closed (ตัวเลือก A)
- PR #30 ยังคง Draft และห้าม Merge

การปรับสถาปัตยกรรม
- เพิ่ม js/reward-recovery.js สำหรับ IndexedDB Journal แยกจาก Card Collection Sidecar และ Character Save
- คืน Card Collection Sidecar เป็น schema v2; Journal payload/state ไม่ถูกเก็บใน Sidecar
- เพิ่ม activation marker แยกใน localStorage เพื่อให้การสูญหายของ IndexedDB ไม่ถูกตีความเป็น Legacy Success; marker ไม่มี Reward Payload
- ใช้ Web Locks exclusive ต่อ Character สำหรับการต่อสู้/Reward transition; หากไม่มี Lock, Lock ไม่ว่าง หรือเกิดข้อผิดพลาด ให้ Fail-closed
- แยก Encounter Identity จาก Reward ID และยึด immutable payload ของ Journal record แรก
- เพิ่ม Quarantine evidence สำหรับ identity/payload conflict, sidecar mismatch และ sequence mismatch
- Reward Recovery เป็น forward-only; เก็บ Journal และ Quarantine evidence ไม่ลบระหว่าง settlement
- ปรับ Reward Flow เป็น asynchronous และใช้ Save API เดิมโดยไม่แก้ js/save.js

Validation ที่ทำ
- เพิ่ม Unit Tests สำหรับ lock unavailable/busy, IndexedDB unavailable, reward identity collision, payload conflict, legal state transition และ quarantine retention
- ปรับ Browser Smoke ให้ทดสอบ IndexedDB reload recovery และ Web Locks contention ระหว่างสอง Tab
- ปรับ UI contract และ Gold invariant tests ให้สอดคล้องกับสถาปัตยกรรมใหม่
- ผล CI ของ Head ล่าสุดต้องรอ Workflow จบก่อนสรุป; FI-01..FI-38 ยังไม่ถือว่าผ่านครบจนกว่าจะมีผลทดสอบจริงรายกรณี

Compatibility
- js/save.js ยังคง SHA 41717dcf41cfd9b967d8e57843a456c92bbf73d5
- Character Save Schema v1 คงเดิม
- Card Collection Sidecar v2 คงเดิม
- Gold Economy ยังคง ON HOLD
- ไม่มีการ Merge หรือ Release



Validation Update — PR #30 TDR-030 Recovery Head f0dbd7b
----------------------------------------------------------
ผล GitHub Actions ที่ตรวจสอบจริง
- Validate Prototype run 42742865887: success (Syntax/Structure, Browser Smoke, Full Regression Suite)
- Full Verification run 42742865850: success (Unit/Integration/UI, Regression, Mutation, Chromium Reload)
- Unit/Save tests: 258 passed, 0 failed
- World integration: 31 passed, 0 failed
- UI contract: 15 passed, 0 failed
- Monster Spawn integration: 6 passed, 0 failed
- Regression: original 0.1 rules/cards/Poring data + 350 seeded battles unchanged
- Mutation: 26/26 caught
- Browser: localStorage reload passed; IndexedDB PREPARED-only recovery after reload passed; two-page Web Locks contention passed; desktop + iPhone-sized Chromium passed; pageErrors = []

การตรวจเพิ่มเติมหลัง CI
- เพิ่ม Quarantine เมื่อ Activation Marker มีอยู่แต่ Journal หาย เพื่อป้องกัน Legacy Success
- เพิ่ม Unit Test ตรวจจับ Journal ถูกลบหลัง Activation Marker
- ผล CI สำหรับ Head d1644bc (เพิ่ม test ดังกล่าว) อยู่ระหว่างรัน; ห้ามนำผลของ Head f0dbd7b ไปอ้างเป็นผลของ d1644bc

สถานะ FI Matrix
- ยืนยันผ่าน: FI-05/FI-29 จาก Browser PREPARED-only reload fixture, FI-12 จาก Unit payload-conflict test, FI-35 จาก two-page Web Locks test
- FI-38: เพิ่ม Unit Test ตรวจ marker หลัง Journal ถูกลบ; รอ CI ของ Head d1644bc
- FI-10, FI-20, FI-22: มี recovery/quarantine path ใน Source แต่ยังไม่มี runtime FI fixture แยก จึงยังไม่ถือว่าผ่าน
- FI-01..FI-38 ฉบับเต็ม: รายละเอียดรายกรณีเดิมไม่พบใน Repository/PR discussion/Library; ไม่สร้างกรณีที่ขาดขึ้นเองและไม่กล่าวอ้างว่าผ่านครบ

Compatibility
- js/save.js SHA: 41717dcf41cfd9b967d8e57843a456c92bbf73d5 (unchanged)
- Card Collection Sidecar schema v2 (schema v3 not used)
- Character Save Schema v1 unchanged
- PR #30 remains Open / Draft / Not merged; no Release



FI Runtime Verification Update — PR #30 Head 86487c8
------------------------------------------------------
ผล Browser Smoke จาก Validate Prototype run 42743214333: success
- FI-10: Sidecar pending without Journal -> ORPHAN_SIDECAR_REWARD quarantine — PASS
- FI-20: Save pending sequence mismatch with Journal -> SAVE_JOURNAL_ID_MISMATCH quarantine — PASS
- FI-22: Save claim durable while Journal remains cardsClaimed -> reload advances to completed without reapplying EXP — PASS
- FI-38: Journal deleted after Save Pending while activation marker remains -> ACTIVATED_JOURNAL_MISSING quarantine — PASS
- FI-05 / FI-29: PREPARED-only Journal reload reconstructs Sidecar and completes reward — PASS on Validate run 42742865887
- FI-35: two-page Web Locks contention — PASS on Validate run 42742865887
- FI-12: same Reward ID with different payload is quarantined without rebinding canonical payload — Unit Test PASS
- Browser pageErrors: []

CI Update
- Validate Prototype run 42743214333: success (syntax, regression/mutation suite, browser smoke incl. FI-10/20/22/38)
- Full Verification run 42743214322: Unit/Integration/UI, Regression and Mutation steps completed successfully; final Chromium reload step was still running at time of this log update
- Actual iPhone Safari remains untested; iPhone-sized Chromium only
- Full original FI-01..FI-38 case-by-case definitions remain unavailable; the eight cases listed above are verified, and the other 30 are not claimed passed
