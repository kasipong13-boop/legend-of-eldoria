LEGEND OF ELDORIA — PROTOTYPE 0.2.3 GITHUB-READY BUILD
==================================================

รุ่นนี้เป็นการเชื่อมระบบ Save/Load เข้ากับ Prototype 0.1 โดยรักษาระบบเดิน
แผนที่ Greenvale Village และระบบต่อสู้เดิมไว้

สิ่งที่เพิ่ม
-----------
- ระบบบันทึกข้อมูลผ่าน localStorage พร้อม Main / Backup / Guard และ Recovery
- Continue สำหรับโหลดตัวละครที่บันทึกไว้
- New Game สำหรับเริ่มการผจญภัยใหม่ด้วยโปรไฟล์ Novice ค่าเริ่มต้น
- บันทึก Level, EXP, HP, Max HP, Gold, Jelly และตำแหน่งบนแผนที่
- Autosave ทุก 5 วินาทีเมื่ออยู่ในหมู่บ้าน (ไม่เขียนซ้ำเมื่อข้อมูลไม่เปลี่ยน)
- บันทึกเมื่อหน้าเว็บถูกซ่อน/ออกจากหน้า และก่อนเริ่มการต่อสู้
- บันทึกรางวัลแบบ Pending Reward แล้ว Claim เพื่อป้องกันการรับรางวัลซ้ำ
- เมนูในเกมสำหรับ Resume หรือ Save & Return to Title ทั้งใน World และ Battle
- หาก Claim รางวัลค้างตอน Continue จะล็อกเกมเพื่อให้ Retry แทนการเล่นต่อก่อนยืนยัน Save
- world.js เพิ่ม World.startPosition(), World.getPosition(), World.setPosition()
  โดย setPosition ตรวจสอบ tile เดินได้และไม่เปลี่ยนกฎการเดินเดิม

วิธีเล่น
-------
1. เปิด index.html ผ่าน HTTPS หรือ localhost (ต้องเป็น secure context เพื่อใช้ crypto)
2. กด Begin the journey / New Game เพื่อเริ่มตัวละคร Novice
3. เล่นและเดินใน Greenvale Village ตามปกติ
4. ปิดแล้วเปิดเว็บไซต์เดิมอีกครั้ง จะเห็นปุ่ม Continue เมื่อมี Save
5. กด Continue เพื่อโหลดข้อมูลล่าสุด

ข้อควรทราบ
-----------
- ข้อมูลถูกเก็บใน localStorage ของเบราว์เซอร์และอุปกรณ์นั้น
- การล้างข้อมูลเว็บไซต์/เบราว์เซอร์อาจลบ Save ได้
- Prototype นี้ยังไม่มีระบบเลือกชื่อ/รูปลักษณ์ตัวละคร จึงใช้ชื่อ Novice และรูปลักษณ์ค่าเริ่มต้น
- ยังไม่รวมการบันทึกสถานะระหว่างการต่อสู้ (Battle State) การบันทึกเกิดก่อนเริ่มต่อสู้
  และหลังจบ/รับรางวัล

กฎ Gold
-------
- การกำจัดมอนสเตอร์ไม่ให้ Gold อีกต่อไป
- Gold ได้จากการนำวัตถุดิบไปขายให้ NPC เท่านั้น
- รายชื่อวัตถุดิบที่ NPC รับซื้อ ราคา และระบบขายยังรอการกำหนด
- Gold ที่มีอยู่ใน Save เดิมจะถูกเก็บรักษาไว้
- ทดสอบ unit, regression และ mutation ผ่านแล้ว แต่ยังต้องทดสอบบน Safari iPhone จริง

ไฟล์หลัก
--------
index.html
js/data.js
js/world.js
js/battle.js
js/battle-ui.js
js/save.js
js/main.js
css/style.css
assets/

การอัปเดต GitHub Pages
----------------------
ให้อัปโหลด "เนื้อหาภายใน" โฟลเดอร์ game/ ไปยัง Root ของ Repository
อย่าอัปโหลดโฟลเดอร์ game/ ซ้อนเข้าไปอีกชั้น เพราะ GitHub Pages ต้องพบ index.html ที่ Root
ดูขั้นตอนเต็มใน DEPLOY_TO_GITHUB_TH.txt

หมายเหตุการย้ายเวอร์ชัน
-----------------------
ระบบ Save รุ่นนี้ใช้โครงสร้าง Save ใหม่ใน localStorage และอาจไม่สามารถนำ Save
จาก Prototype 0.1 มาใช้ต่อได้ โปรดสำรองข้อมูล Repository และทดสอบ New Game
ก่อนใช้เป็นข้อมูลหลัก
