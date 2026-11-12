# WF-ASSET-01 — รายงานต้นแบบสำหรับ Game Director

สถานะ: DRAFT / ยังไม่อนุมัติใช้จริง
วันที่: 12 พฤศจิกายน 2026

## หลักฐานที่ตรวจแบบ read-only
Repository: kasipong13-boop/legend-of-eldoria
Local revision: c79744071f9b6ea78b3f21b669aaeaffae4633a9 (ไม่อ้างว่าเป็น remote HEAD ล่าสุด)

- docs/ART_DIRECTION_AND_ASSET_PIPELINE_v1.1.md §1, §1.1, §3: detailed classic MMORPG pixel art, Isometric 2:1, ground 64×32, Novice frame cell 96×96 / 8 directions; ช่องเฟรมไม่ใช่ความสูงตัวละครที่วาดจริง
- js/world.js: TW=64, TH=32 และ iso(x,y)=((x-y)*32,(x+y)*16); drawGround/drawTree/drawHero เป็น procedural Canvas
- drawTree เดิมสูงประมาณ 60 px, drawHero สูงประมาณ 43 px รวมผม; ไม่ใช่ sprite production benchmark
- docs/WHISPERING_FOREST_MAP_DESIGN.md: กริดแผนที่ 16×16; เอกสารบางส่วนยังบอกว่าไม่เชื่อม runtime แต่ world.js มี setMap แล้ว จึงใช้โค้ดเป็นหลักสำหรับสถานะ runtime
- ภาพฝังใน greenvale-art-preview.html เป็น WEBP 192×128 RGB สำหรับ mood/composition เท่านั้น ไม่ใช่ tileset
- tracked raster asset มี apple-touch-icon.png; ตรวจรายชื่อทั้งสอง ZIP แล้วไม่พบ environment sprite/tileset เพิ่มเติม
- ไม่มีมาตรฐาน canvas ของ tree/bush/rock ในเอกสาร จึงเสนอ canvas ทดลองก่อนสร้าง: tree 128×160, bush/rock 64×48; ground ตามมาตรฐาน 64×32

## สิ่งที่ส่ง
PNG แยก 12 ไฟล์ใน assets/: tree 3, bush 2, rock 2, grass 3, dirt 2
Asset Contact Sheet, Forest Map Preview และภาพขยาย 2x
manifest.json ระบุ canvas, pivot, footprint ที่เสนอ, SHA-256 และสถานะ draft
validation.json เป็นผลตรวจจริง; generate.py เป็น source ที่ทำซ้ำได้ด้วย Python + Pillow 13

ทุกชิ้นวาดด้วย integer pixel/line/polygon และ controlled palette โดยตรง ไม่มีภาพ placeholder ไม่มี asset จาก Ragnarok และไม่ใช้ image generator ไม่มี blur หรือ antialias; ขยายด้วย nearest-neighbor เท่านั้น

## มุมมองและสเกล
Ground เป็น diamond 2:1 แบบ pixel-center half-open rasterization; pivot (32,16)
Tree pivot (64,144), bush (32,39), rock (32,38)
วางภาพด้วย top_left = iso(c,r) - pivot; depth order ใช้ c+r ใน preview
Footprint 1×1 เป็นข้อเสนอเพื่อจัดภาพ ไม่ใช่ข้อมูล collision ที่อนุมัติ; canopy ต้นไม้กว้างประมาณ 1.4–1.6 tiles และสูงประมาณ 2.3 tiles ตามช่วงข้อมูล alpha
ต้นไม้สูงกว่า procedural tree เดิมมาก จึงต้องให้ Director ประเมินกับ Novice sprite จริงก่อน integration; ไม่ควรย่อ 128×160 ลง 50% โดยอัตโนมัติ เพราะเปลี่ยน pixel density

## ผลการตรวจ
- PNG ทั้ง 12 เปิดและ verify ผ่าน, mode RGBA, มีเนื้อภาพจริงและหลายสี ไม่มีไฟล์เปล่า
- alpha ทุก asset มีเฉพาะ 0/255: พื้นนอกภาพโปร่งใส ขอบคม ไม่มีพื้น checkerboard ฝังใน asset
- Contact Sheet ใช้ checkerboard เป็นพื้นสำหรับตรวจ alpha เท่านั้น; preview ใช้พื้นทึบเพื่ออ่านองค์ประกอบ
- กริด 7×7 ในการตรวจ coverage: พื้นที่กลาง 181×91 px ไม่มีช่องว่างและไม่มี overlap
- ตรวจ consistency ของ boundary band ทุกคู่ variant ภายในหญ้า 36 คู่/ทิศ และดิน 16 คู่/ทิศ ผ่าน; เป็นการตรวจสีขอบและ mask ไม่ใช่ perceptual seam scoring
- mask ร่วมกันทุก ground tile ทำให้ mixed grass/dirt ต่อทางเรขาคณิตได้โดยไม่มีช่องโปร่งใส แต่สีเปลี่ยนเป็นขอบตรง
- ตรวจภาพจริงผ่าน image viewer ที่ native resolution ทั้ง Contact Sheet และ Map Preview; ปรับยอด tree_03 ให้ไม่ชนขอบ canvas และเพิ่มรูปทรงแยกของ rock_02
- Preview ประกอบจาก PNG ใน assets จริง เป็น art test 12×12 ไม่ใช่สำเนาแมป gameplay 16×16 และไม่ได้แก้ map data

## ประเมินคุณภาพอย่างตรงไปตรงมา
เหมาะสำหรับตรวจ pipeline / palette / silhouette และการจัดภาพต้นแบบ ยังไม่ถึงคุณภาพ detailed classic MMORPG production art
จุดดี: silhouette อ่านได้, palette รวมกันได้, แสงบนซ้าย, หินเป็นเหลี่ยม, ground ต่อง่ายและ alpha คม
ข้อจำกัด: ใบไม้ยังดูเป็นกลุ่มวงรีซ้ำ/รายละเอียดบางส่วนสุ่มด้วย seed คงที่, สนมีชั้นเป็นแถบ, grass ลวดลายซ้ำชัดเมื่อปูพื้นที่ใหญ่, dirt ทั้งสองแบบต่างกันน้อย, เงาฐานทึบเข้มและ baked ใน sprite, รอยต่อ grass/dirt แข็ง
ควรปรับต่อ: hand cleanup ของ canopy/leaf clusters, สร้าง palette/lighting benchmark ให้ Director เลือก, เพิ่ม transition/corner/edge/path end tiles, แยก shadow layer, ทดสอบต้นไม้บดบังตัวละครและ readability บนมือถือกับ sprite Novice จริง
ยังไม่ทดสอบในเกม, mobile, DPR, performance หรือ gameplay regression เนื่องจากงานนี้ห้ามแก้/เชื่อม runtime และไม่มีการเปลี่ยนโค้ดเกม

## ขอบเขตและการตัดสินใจ
Repository working tree ยังคงสะอาด ไม่มีการแก้โค้ดเกม, Save Engine, Save Schema, GAME_CONFIRMED; ไม่มี commit/push/merge/PR
ไฟล์ทั้งหมดอยู่ในพื้นที่ชั่วคราวของ Codex เท่านั้น
ขอให้ Game Director ตรวจภาพ เลือก/ปรับ scale, ความละเอียดใบไม้, เงาฐาน และแนวทาง transition ก่อนเริ่มรอบต่อไป ไม่มีการเผยแพร่หรือส่งข้อความไปภายนอก

ข้อจำกัดการส่งไฟล์: path /codex/browser/projectless/0001-legend-of-eldoria-wf-asset-01-pixel-art-asset-wh/output ที่ระบบระบุไม่มีอยู่ใน executor นี้; mkdir ได้ Permission denied และเครื่องไม่มี sudo จึงเก็บชุดงานที่ /workspace/work/wf-asset-01/output แทน ยังไม่สามารถรับรองลิงก์ดาวน์โหลดผ่าน UI ได้
