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
