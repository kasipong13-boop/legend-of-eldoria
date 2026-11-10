# บันทึกการเปลี่ยนแปลง — Prototype 0.2.3

## เพิ่ม/ปรับปรุง
- เพิ่ม In-game Menu ในหน้า World และ Battle
- เพิ่ม Resume และ Save & Return to Title; ต้องบันทึกสำเร็จก่อนออกจากเกม
- ป้องกันการ Continue เมื่อ Pending Reward ยัง Claim/Commit ไม่สำเร็จ โดยแสดง Save Lock ให้ Retry
- เพิ่ม UI contract tests สำหรับเมนู, การบันทึกก่อนกลับ Title, Pending Reward และ script paths
- ปรับชุด Verification ให้รันได้ทั้งจากโครงสร้างทำงานที่มี `game/` และจาก GitHub repository root
- อัปเดตหน้า Title เป็น Prototype 0.2.3

## คงเดิม
- `data.js`, `battle.js`, `battle-ui.js` และกติกาการต่อสู้เดิม
- Regression snapshot: ค่าของเกมและผลจำลอง 350 battles ตรงกับ Prototype 0.1 baseline

## ผลตรวจ
- Save Unit/Fuzz/Review/Transaction: 223 ผ่าน
- World + UI Integration: 7 ผ่าน
- Regression: ผ่าน 350 seeded battles
- Mutation: 26/26 ถูกตรวจจับ
- JavaScript syntax: ผ่าน
- SHA-256 manifest และ ZIP integrity: ผ่าน
- Browser automation: SKIP เพราะไม่มี Playwright/Chromium ใน environment

## ข้อจำกัดที่ยังต้องทดสอบหลัง Deploy
- Safari บน iPhone และ Chrome บน PC จริง (touch, viewport, orientation, localStorage, page lifecycle)
- Save ใช้ localStorage เฉพาะ browser/device ไม่ซิงก์ข้ามอุปกรณ์
- Browser test ที่ SKIP ไม่ใช่หลักฐานว่าผ่านการทดสอบอุปกรณ์จริง

## Art Direction v1.1
- ยืนยัน Visual Direction ใหม่ตามการเลือกของผู้ใช้: Detailed Pixel Art + Isometric แบบ Ragnarok Online Classic-inspired
- ทิศทาง Pixel Art นี้ใช้แทนแนวทดลอง 2.5D ที่เคยพิจารณาก่อนหน้า
- เพิ่มเอกสาร `docs/ART_DIRECTION_AND_ASSET_PIPELINE_v1.1.md` ครอบคลุม Art Bible, Greenvale visual target, modular asset pipeline, repository structure และ QA gates
- ยืนยันกริด Isometric ตาม renderer ปัจจุบัน: 64×32 logical ground tile; คง Character benchmark เดิม 96×96 px, 8 directions
- Greenvale concept image เป็น reference เท่านั้น ยังไม่ใช่ production tileset/spritesheet และยังไม่เปลี่ยน asset/runtime/gameplay


## Card Acquisition Foundation — Port onto current Save Engine (PR #30, Draft)
- เริ่ม Port งานจาก PR #23 เดิมใหม่บน `main` หลัง Merge PR #29 โดยไม่ใช้ legacy branch เป็นฐาน
- เพิ่ม `js/card-acquisition.js` สำหรับ Monster Special Skill Card drop validation; Rarity 5 ระดับ และ Drop Chance แยกจากกัน
- ตารางดรอปของ Poring, Forest Wolf และ Ancient Wolf ยังคงว่าง รอการอนุมัติ Card Identity, Rarity และอัตราดรอปจริง
- เพิ่ม Card Collection Sidecar schema v2 สำหรับ staging/claim receipt แบบ idempotent พร้อมอ่าน sidecar schema v1 ได้และ migrate เมื่อมีการเขียนครั้งถัดไป
- เชื่อมรางวัลการ์ดกับ Victory Reward โดยไม่แก้ `js/save.js`, Save Schema v1 หรือรูปแบบ Pending Reward เดิม
- Duplicate stack ตาม `cardId + stars`; การ์ดต่างระดับดาวแยกเป็นคนละรายการ
- เพิ่มการ Retry เมื่อ Sidecar storage ขัดข้อง และป้องกันการสร้าง Pending Reward ซ้ำหลัง Save Engine resume สำเร็จ
- CI ล่าสุดบน PR head `5a17d75`: syntax/structure, unit/integration/regression/mutation และ browser smoke ผ่านทั้งหมด
- ผลทดสอบ: Unit 245, Integration/UI 30, World/UI 14, Monster Spawn 6 ผ่าน; 0 failures; Mutation 26/26 caught; regression 350 seeded battles คงเดิม
- Browser smoke ผ่าน Desktop และ iPhone-sized Chromium พร้อม real localStorage reload; ไม่มี page errors
- PR #30 ยังเป็น Draft และยังไม่ Merge; ต้องผ่าน Final Review และได้รับอนุมัติ Merge จาก Game Owner ก่อน
