# Vanguard D Deck Lab

เกมแฟนเมดสำหรับซ้อมเด็ค Cardfight!! Vanguard (D Standard) — การ์ดชุดญี่ปุ่นทั้งหมดทำงานอัตโนมัติ เล่นคนเดียว สู้บอท หรือออนไลน์กับเพื่อนด้วยรหัสห้อง 6 ตัว

**ดาวน์โหลดเกม (Windows):** หน้า [Releases](../../releases/latest) → `VanguardDeckLab-Setup-*.exe` (ติดตั้ง) หรือ `VanguardDeckLab-Portable-*.exe` (ไม่ต้องติดตั้ง)

- รูปการ์ดโหลดจากเว็บทางการในเครื่องของผู้เล่นแต่ละคน ไม่มีรูปการ์ดหรือข้อความการ์ดทางการอยู่ใน repo นี้
- ห้องออนไลน์ใช้บริการนัดพบฟรีของ [PeerJS](https://peerjs.com) แล้วส่งข้อมูลเกมตรงระหว่างสองเครื่อง
- ไม่ได้เกี่ยวข้องกับหรือได้รับการรับรองจาก Bushiroad

## สำหรับนักพัฒนา
- `node build.mjs` → `dist/local/VanguardDeckLab.html` (ตัวเกม) และ `dist/vanguard-d-deck-lab.html`
- เทส: ดู `TASKS.md` หัวข้อ Tests · เทสห้องจริงบนอินเทอร์เน็ต: GitHub Actions "Online room test"
- ตัวเกม Windows: GitHub Actions "Build Windows game" (Electron) → Releases
