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
