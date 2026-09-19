# จอเว็บสำหรับทดลอง PromptPay

ใช้แทน Android ระหว่างทดสอบ โดยไม่เปลี่ยนสองโปรเจกต์หลัก

```sh
npm install
npm start
```

เปิด http://localhost:8080 เพื่อใช้แผงควบคุมและดูจอพร้อมกัน หรือ http://localhost:8080/display เพื่อเปิดเฉพาะจอ

- เลือกยอด 150 / 259 / 1,259 บาท หรือกรอกเอง
- กดแสดง QR; เมื่อครบเวลาจะกลับสู่วิดีโอ
- กดซ่อน QR หรือส่งยอดล่าสุดซ้ำได้
- Alt/Option + Q / X / R ทำงานบนหน้าแผงควบคุมเมื่อหน้านี้มี focus
- วิดีโอตัวอย่างอยู่ใน `public/video.mp4` เป็นคลิปที่สร้างสำหรับทดสอบ เก็บในเครื่องและเล่นวน
- QR ใช้หมายเลขตัวอย่าง `0812345678` เพื่อทดสอบเท่านั้น ไม่ใช้รับเงินจริง

## เชื่อม Extension จริง

เปิดหัวข้อ “เชื่อม Chrome Extension กับจอทดสอบนี้” เพื่อดู LAN IP ของคอมพิวเตอร์ ใส่ IP นั้นใน Extension หรือใช้ `localhost` / `127.0.0.1` เมื่อ Chrome และเว็บทดสอบอยู่บนเครื่องเดียวกัน (Extension v1.0.1 ขึ้นไป)

Port: `8080`

API token เริ่มต้น: `promptpay-local-demo-token`

ทดสอบ Connection แล้วใช้ Extension กับ Google Sheets ตามคู่มือเดิม หน้าแผงควบคุมนี้ใช้รายการจำลอง ไม่ได้อ่าน Google Sheets

API มี `POST /show`, `POST /hide`, `GET /status` และ CORS เหมือน Android ต้องส่ง Authorization: Bearer token โดย status ในตัวทดสอบเพิ่มภาพ QR แบบ data URL และ revision สำหรับวาดจอเว็บ

นี่เป็น test harness บน LAN ที่เชื่อถือได้ ใช้ token สาธิตที่ระบุไว้ใน source ไม่ใช่ระบบ production เปลี่ยน `API_TOKEN` และ `PORT` ผ่าน environment ได้; เมื่อเปลี่ยน token ให้กรอกค่าตรงกันในหน้าแผงควบคุม ตัวจอใช้ localStorage จาก origin เดียวกัน
