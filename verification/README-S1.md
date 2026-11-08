# Legend of Eldoria: ชุดทดสอบ S1 (ระบบเซฟ)

ชุดนี้รันได้ในตัวเอง ไม่ต้องติดตั้งอะไรเพิ่มนอกจาก **Node.js 20 ขึ้นไป** (ใช้ตัวรันเทสต์ `node:test` ที่มากับ Node) ไม่ต้องใช้ Python และไม่ต้อง `npm install`

## ในชุดนี้มีอะไร

```
game/                  สำเนาพัฒนา: ไฟล์ Prototype 0.1 เดิมทุกไฟล์ + js/save.js (ยังไม่ถูกเชื่อมกับเกม)
tests/
  lib/save-helpers.js     storage จำลองในหน่วยความจำ, hook จำลองความล้มเหลว, ตัวช่วยสร้างสถานะ
  lib/load-game-logic.js  โหลด data.js + battle.js แบบแยกขาด เพื่อทำ regression
  unit/save-core.test.js  checksum, ชื่อไทย/Unicode, characterId, validation
  unit/save-tx.test.js    สร้างตัวละคร, ดัชนี, commit, Resume, Recovery, Preserve Source, discard
  unit/save-fuzz.test.js  สุ่มให้ล้มเหลว/เขียนเสีย/ปิดแอปทุกขั้น (6 seed)
  unit/save-review.test.js  regression ของ 3 ประเด็นที่ ChatGPT ตรวจพบ
  run-unit.js             รันเทสต์ทุกไฟล์ใน unit/
  mutation.js             ใส่บั๊กโดยตั้งใจทีละแบบ (รายการใน mutations.json) แล้วดูว่าเทสต์จับได้ไหม
  mutations.json          รายการ mutation 26 แบบ (ข้อความที่ค้นหาและข้อความที่ใช้แทน)
  check-regression.js     ยืนยันว่าค่าเกมและผลต่อสู้แบบ seed 350 ครั้งเหมือน 0.1
  baseline/               snapshot ของ 0.1 + สคริปต์สร้าง snapshot
  browser/save-in-browser.js  (ไม่บังคับ) ทดสอบกับ localStorage ของ Chromium จริง
```

## วิธีรัน

เปิด Terminal ในโฟลเดอร์นี้ แล้วรัน:

```
node tests/run-unit.js
node tests/check-regression.js
node tests/mutation.js
```

หรือใช้ `npm test`, `npm run regression`, `npm run mutation`, `npm run all`

**ตรวจ baseline กับ 0.1 ของคุณเอง:** ถ้าต้องการยืนยันว่า baseline ที่เก็บไว้มาจาก 0.1 จริง ให้แตก `eldoria-prototype-0.1.zip` แล้วรัน
```
node tests/check-regression.js /path/to/eldoria-0.1/eldoria
```

**ทดสอบในเบราว์เซอร์จริง (ไม่บังคับ):** ต้องติดตั้ง Playwright ก่อน (`npm i playwright && npx playwright install chromium`) แล้วรัน `node tests/browser/save-in-browser.js` ถ้าไม่มี Playwright สคริปต์จะแจ้ง SKIP

## ผลที่ควรได้

| คำสั่ง | ผลที่ควรได้ |
|---|---|
| `run-unit.js` | `# pass 223` และ `# fail 0` |
| `check-regression.js` | `PASS` |
| `mutation.js` | บรรทัดแรก `CONTROL unmodified save.js: pass=223 fail=0` แล้วจบด้วย `26/26 mutations caught` |

`mutation.js` รัน Control ก่อนเสมอ ถ้าโค้ดที่ไม่ได้แก้ไม่ผ่าน จะหยุดทันที เพื่อไม่ให้ได้ผล "จับได้" ปลอม

## หมายเหตุ

- `tests/lib/save-helpers.js` อ่าน `save.js` จาก `game/js/save.js` หรือจากโฟลเดอร์ที่ระบุใน `ELDORIA_DIR` (ตัว mutation ใช้วิธีนี้ชี้ไปที่สำเนาที่ใส่บั๊ก)
- อักขระพิเศษในไฟล์เทสต์เขียนเป็น `\u` escape เพื่อให้อ่านตรวจได้
- fuzz test ใช้เวลานานที่สุด (หลายวินาที) เทสต์ทั้งหมดไม่ต้องใช้อินเทอร์เน็ต
- `SHA256SUMS.txt` เก็บค่า hash ของทุกไฟล์ในชุดนี้
