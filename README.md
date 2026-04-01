# 🏨 ResortDesk — Guest Management System

ResortDesk is a lightweight, cloud-based guest management system designed for small resorts, boutique hotels, and homestays. It runs entirely in the browser with no installation required and syncs data in real-time with Google Sheets.

---

## 🚀 Live Demo
👉 https://desk.mykonoscottagetarkarli.com/index.html

---

## ✨ Features

- 📝 **Guest Check-In** – Register guests with ID, payment & booking details
- 🔄 **Real-Time Sync** – Auto-sync with Google Sheets every 30 seconds
- 🏠 **Room Availability Board** – Live room status (occupied/available)
- 📅 **Booking Calendar** – Manage advance reservations
- 💬 **WhatsApp Integration** – Send confirmations & reminders instantly
- 🧾 **GST Invoice Generator** – Print & share tax invoices
- 📊 **Revenue Dashboard** – Track earnings & booking sources
- 👥 **Guest Records** – Search, edit, checkout & manage data
- 🔐 **Role-Based Access** – Admin & staff permissions
- 🏨 **Multi-Hotel Support**

---

## 🛠️ Tech Stack

- HTML  
- CSS  
- JavaScript  
- Google Apps Script  
- Google Sheets (Database)

---

## ⚙️ How It Works

1. User fills guest check-in form  
2. Data is sent to Google Apps Script backend  
3. Stored in Google Sheets  
4. Dashboard auto-syncs and updates in real-time  

---

## 📱 Compatibility

- Works on all devices  
- Optimized for mobile & low-end Android phones  
- No app installation required  

---

## 📸 Screenshots

(Add screenshots of dashboard, check-in form, room board)

---

## 📌 Setup Instructions

1. Clone the repository  
2. Connect your Google Apps Script Web App URL  
3. Update:
```js
const REGISTRY_URL = "YOUR_SCRIPT_URL";
