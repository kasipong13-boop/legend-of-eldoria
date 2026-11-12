# WF-MAP-01 — Whispering Forest Map Preview

สถานะ: **EXPERIMENT / รอ Game Director ตรวจ** · ไม่เชื่อมกับเกมหลัก · ไม่บันทึกข้อมูล

## ที่มา
- Asset: `experiments/wf-asset-01/` @ `e26cf54ea22746559b3bd68b850177e83bd166db` (PNG 12 ชิ้นจาก Codex, ใช้ไฟล์จริงไม่แก้ไข)
- ผังแมป: คัดลอกจาก `js/map-data.js` → `whispering_forest.tiles` (16×16) @ main `c79744071f9b6ea78b3f21b669aaeaffae4633a9`
- ตัวละคร: คัดลอกรูปทรงจาก `drawHero()` ใน `js/world.js` (ไม่ได้แก้ไฟล์เดิม) แล้ววาดที่ความละเอียด art 1× ให้ความหนาแน่นพิกเซลตรงกับ PNG

## ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้า Preview (โหลด PNG จาก `../wf-asset-01/assets/`) |
| `preview.css` | UI มือถือ/PC, safe-area iPhone |
| `forest-map.js` | ผังแมป, ตาราง asset+pivot, การวาง prop, ทางเดินดิน, จุด Warp |
| `preview.js` | Renderer isometric, Collision, Camera, จอย/แตะเดิน/คีย์บอร์ด, Warp, Depth sort |
| `standalone/wf-map-preview-01.html` | ไฟล์เดียวที่ฝัง PNG ไว้ในตัว (build จาก `tools/build_standalone.py`) |
| `tests/smoke.py` | ทดสอบอัตโนมัติใน Chrome headless (35 รายการ) |
| `screenshots/` | ภาพจากการทดสอบจริง |

## สิ่งที่ทำงานได้
- พื้นหญ้า 3 แบบ + ทางดิน 2 แบบ (ทางเดินสำรวจเป็นภาพเท่านั้น ไม่เปลี่ยน collision)
- ต้นไม้/พุ่มไม้/หิน 1 ชิ้นต่อช่อง `#` (94 ชิ้น) — ทุกชิ้นกันเดิน ตรงกับ map data
- Collision แบบกล่อง 0.44 tile ไถลตามกำแพง, ห้ามตัดมุมเมื่อแตะเดิน
- Camera follow แบบนุ่ม + ล็อกไม่ให้เลยขอบแมป
- จอยสติ๊กซ้ายล่าง, แตะพื้นเพื่อเดิน (BFS), WASD/ลูกศร, ปุ่มซูม (สเกลจำนวนเต็ม ภาพคมตลอด)
- Warp: `forest_to_greenvale` (1,1) แสดงข้อความเท่านั้น · Warp ทดลอง (14,1) ⇄ (14,14)
- Depth sort ตาม c+r: เดินหลังต้นไม้ถูกบัง, เดินหน้าต้นไม้อยู่ด้านหน้า; ต้นที่บังตัวละครจะโปร่ง 50% (ตรวจระดับพิกเซลจาก alpha)
- ปุ่มดีบัก: Grid, Collision, Tree fade, Hero ×1/×1.5 (ช่วยตัดสินสเกล), Start

## เปิดบนเครื่อง
```
cd experiments && python3 -m http.server 8000
# เปิด http://localhost:8000/wf-map-preview-01/
```
หรือเปิด `standalone/wf-map-preview-01.html` ได้โดยตรง

## ทดสอบ
```
python3 experiments/wf-map-preview-01/tests/smoke.py
python3 experiments/wf-map-preview-01/tools/build_standalone.py   # หลังแก้ไฟล์
```

## ข้อจำกัดที่ทราบ
- น้ำ (`~`) เป็น placeholder ที่วาดด้วยโค้ดจาก mask ของ grass_tile_01 — WF-ASSET-01 ไม่มี asset น้ำ
- ตัวละครเป็นรูปทรง procedural เดิม ไม่มีเฟรม 8 ทิศ และเล็กกว่าต้นไม้มาก (ประมาณ 43 px เทียบ 150 px)
- รอยต่อหญ้า/ดินเป็นขอบตรง (ไม่มี transition tile)
- ยังไม่ได้ทดสอบบน iPhone จริง ผลทดสอบมาจาก Chrome headless จำลองขนาดจอ iPhone
