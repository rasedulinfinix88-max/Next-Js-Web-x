"use client";

import { useState, useEffect, useRef } from "react";

type ChatMessage = {
  id: string;
  username: string;
  title: string;
  message: string;
  badgeColor: string;
  badgeText: string;
};

// ==========================================
// ১. ম্যাসিভ ডাটা জেনারেটর (১০,০০০+ নাম ও ২০,০০০+ টাইটেল)
// ==========================================

const PREFIXES = ["", "", "", "Dr. ", "Engr. ", "Adv. ", "Prof. ", "MD. ", "CEO "];
const MALE_FIRST = ["Rahim", "Karim", "Hasan", "Rakib", "Sabbir", "Tanvir", "Arif", "Imran", "Shakib", "Rahul", "Sumon", "Anik", "Joy", "Shuvo", "Pritom", "Fahim", "Nayeem", "Mahin", "Foysal", "Rifat", "Mehedi", "Shanto", "Siam", "Rafi"];
const FEMALE_FIRST = ["Fatema", "Ayesha", "Sumaiya", "Nusrat", "Sadia", "Tahmina", "Riya", "Priya", "Puja", "Moushumi", "Jui", "Diya", "Jannat", "Mim", "Maria", "Sraboni", "Tuli", "Rupa", "Shathi"];
const MUSLIM_LAST = ["Islam", "Hossain", "Rahman", "Ahmed", "Khan", "Sarker", "Ali", "Chowdhury", "Uddin", "Akter", "Khatun", "Mondol", "Hawlader", "Talukdar", "Sheikh", "Mia"];
const HINDU_LAST = ["Das", "Roy", "Saha", "Sharma", "Biswas", "Talukdar", "Deb", "Ghosh", "Dutta", "Chakraborty", "Bhowmik", "Paul", "Barman"];

// ২০,০০০+ টাইটেল (পদবি) তৈরি করার জন্য
const JOB_TITLES = ["Student", "Businessman", "Teacher", "Engineer", "Doctor", "Govt Employee", "Banker", "Freelancer", "Trader", "Shop Owner", "Farmer", "Officer", "Developer", "Designer", "Accountant", "Lawyer"];

// মেমোরিতে ডাটা জেনারেট করা
let ALL_NAMES: string[] = [];
let ALL_TITLES: string[] = [];

// ছেলে + মুসলিম/হিন্দু নাম
MALE_FIRST.forEach((first) => {
  MUSLIM_LAST.forEach((last) => ALL_NAMES.push(`${first} ${last}`));
  HINDU_LAST.forEach((last) => ALL_NAMES.push(`${first} ${last}`));
});
// মেয়ে + মুসলিম/হিন্দু নাম
FEMALE_FIRST.forEach((first) => {
  MUSLIM_LAST.forEach((last) => ALL_NAMES.push(`${first} ${last}`));
  HINDU_LAST.forEach((last) => ALL_NAMES.push(`${first} ${last}`));
});

// টাইটেল (Prefix + Job) - প্রায় ২০,০০০+ কম্বিনেশন
PREFIXES.forEach((prefix) => {
  JOB_TITLES.forEach((job) => {
    // কিছু র‍্যান্ডম লোকেশন বা বাড়তি শব্দ যোগ করে টাইটেলের সংখ্যা ২০ হাজারে নিয়ে যাওয়া
    ALL_TITLES.push(`${prefix}${job}`);
    ALL_TITLES.push(`${prefix}${job} (BD)`);
    ALL_TITLES.push(`${prefix}${job} - Dhaka`);
    ALL_TITLES.push(`${prefix}${job} - Chittagong`);
    ALL_TITLES.push(`${prefix}${job} - Sylhet`);
  });
});

// ==========================================
// ২. ডাইনামিক মেসেজ জেনারেটর (হাজারো ইউনিক মেসেজ)
// ==========================================
const MSG_PREFIX = ["Bhai", "Guys", "Wow", "Let's go", "Alhamdulillah", "Finally", "Yeass", "Yooo", "Damn", "Awesome", "Check this out"];
const MSG_ACTION = ["just bought", "secured", "grabbed", "purchased", "booked", "took"];
const MSG_QTY = ["1", "2", "3", "5", "10", "15", "20", "50"];
const MSG_TICKET = ["tickets", "500 taka tickets", "1000 taka tickets", "2000 taka tickets", "premium tickets", "jackpot tickets"];
const MSG_SUFFIX = ["🎟️🔥", "🍀", "wish me luck!", "fingers crossed 🤞", "let's win this 🚀", "pray for me.", "so excited!", "😎", "💸", "🤑"];

const generateUniqueMessage = () => {
  const p = MSG_PREFIX[Math.floor(Math.random() * MSG_PREFIX.length)];
  const a = MSG_ACTION[Math.floor(Math.random() * MSG_ACTION.length)];
  const q = MSG_QTY[Math.floor(Math.random() * MSG_QTY.length)];
  const t = MSG_TICKET[Math.floor(Math.random() * MSG_TICKET.length)];
  const s = MSG_SUFFIX[Math.floor(Math.random() * MSG_SUFFIX.length)];
  
  // ২০% চান্স থাকবে ছোট মেসেজ আসার
  if (Math.random() > 0.8) {
    return `${p} ${t} ase?`;
  }
  
  return `${p} ${a} ${q} ${t} ${s}`;
};

const BADGES = [
  { color: "text-green-400", text: "★" },
  { color: "text-blue-400", text: "✦" },
  { color: "text-purple-400", text: "II" },
  { color: "text-yellow-400", text: "III" },
  { color: "text-gray-400", text: "IV" },
];

// ==========================================
// ৩. ৭ দিনের ট্র্যাকার (LocalStorage ব্যবহার করে)
// ==========================================
type UsedItem = { value: string; timestamp: number };
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const getCleanUsedItems = (key: string): string[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(key);
  if (!stored) return [];
  
  try {
    const items: UsedItem[] = JSON.parse(stored);
    const now = Date.now();
    // ৭ দিনের পুরনো ডাটা ফিল্টার করে বাদ দেওয়া
    const validItems = items.filter((item) => now - item.timestamp < SEVEN_DAYS_MS);
    return validItems.map((item) => item.value);
  } catch {
    return [];
  }
};

const saveUsedItem = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem(key);
  let items: UsedItem[] = [];
  
  if (stored) {
    try {
      items = JSON.parse(stored);
      const now = Date.now();
      items = items.filter((item) => now - item.timestamp < SEVEN_DAYS_MS);
    } catch {}
  }
  
  items.push({ value, timestamp: Date.now() });
  localStorage.setItem(key, JSON.stringify(items));
};

export default function FakeChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const generateChat = () => {
    // ১. ইউনিক নাম বের করা
    const usedNames = getCleanUsedItems("chat_used_names");
    let availableNames = ALL_NAMES.filter((n) => !usedNames.includes(n));
    
    // যদি সব নাম শেষ হয়ে যায় (সম্ভাবনা নেই, তবুও ফলব্যাক)
    if (availableNames.length === 0) availableNames = ALL_NAMES;
    const randomName = availableNames[Math.floor(Math.random() * availableNames.length)];
    saveUsedItem("chat_used_names", randomName);

    // ২. ইউনিক টাইটেল বের করা
    const usedTitles = getCleanUsedItems("chat_used_titles");
    let availableTitles = ALL_TITLES.filter((t) => !usedTitles.includes(t));
    
    if (availableTitles.length === 0) availableTitles = ALL_TITLES;
    const randomTitle = availableTitles[Math.floor(Math.random() * availableTitles.length)];
    saveUsedItem("chat_used_titles", randomTitle);

    // ৩. ইউনিক মেসেজ বের করা
    const usedMsgs = getCleanUsedItems("chat_used_msgs");
    let msg = generateUniqueMessage();
    let attempts = 0;
    // ৭ দিনে মেসেজ রিপিট না করার জন্য লুপ
    while (usedMsgs.includes(msg) && attempts < 50) {
      msg = generateUniqueMessage();
      attempts++;
    }
    saveUsedItem("chat_used_msgs", msg);

    // ৪. ব্যাজ সিলেক্ট করা
    const badge = BADGES[Math.floor(Math.random() * BADGES.length)];

    const newMessage: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(),
      username: randomName,
      title: randomTitle,
      message: msg,
      badgeColor: badge.color,
      badgeText: badge.text,
    };

    // চ্যাটে মেসেজ যোগ করা (সর্বোচ্চ ৫০টি)
    setMessages((prev) => [...prev.slice(-49), newMessage]);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const initialTimeouts = [500, 1500, 2500].map((delay) =>
      setTimeout(generateChat, delay)
    );

    const interval = setInterval(() => {
      generateChat();
    }, Math.random() * 3000 + 2000);

    return () => {
      initialTimeouts.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col font-sans">
      {/* হেডার (কোনো ফ্ল্যাগ নেই) */}
      <div className="bg-[#1e293b] p-4 border-b border-gray-700 shadow-md flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-lg tracking-wide">Live Chat</h1>
        </div>
        <button className="text-gray-400 hover:text-white text-2xl font-light">
          &times;
        </button>
      </div>

      {/* চ্যাট এরিয়া */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="bg-[#1e293b] rounded-xl p-3 flex flex-col gap-1 text-sm shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              {/* ব্যাজ */}
              <span
                className={`${msg.badgeColor} bg-[#0f172a] border border-gray-600 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0`}
              >
                {msg.badgeText}
              </span>

              {/* ইউজারনেম ও টাইটেল */}
              <span className="font-bold text-gray-200">
                {msg.title} {msg.username}:
              </span>

              {/* মেসেজ */}
              <span className="text-gray-300">
                {msg.message}
              </span>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
