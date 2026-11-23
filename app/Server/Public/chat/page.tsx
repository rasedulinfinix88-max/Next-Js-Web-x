"use client";

import { useState, useEffect, useRef } from "react";

// --- টাইপ ডিফিনিশন ---
type ChatMessage = {
  id: string;
  username: string;
  message: string;
  badgeColor: string;
  badgeText: string;
  time: string;
};

// --- ডাটা পুল: বাংলাদেশি নাম (হিন্দু, মুসলিম, ছেলে, মেয়ে) ---
const TITLES = ["", "", "", "Dr. ", "Engr. ", "Adv. ", "Prof. "]; // শিক্ষিত/টাইটেল
const FIRST_NAMES_MALE = ["Rahim", "Karim", "Hasan", "Rakib", "Sabbir", "Tanvir", "Arif", "Imran", "Shakib", "Rahul", "Sumon", "Anik", "Joy", "Shuvo", "Pritom"];
const FIRST_NAMES_FEMALE = ["Fatema", "Ayesha", "Sumaiya", "Nusrat", "Sadia", "Tahmina", "Riya", "Priya", "Puja", "Moushumi", "Jui", "Diya"];
const LAST_NAMES_MUSLIM = ["Islam", "Hossain", "Rahman", "Ahmed", "Khan", "Sarker", "Ali", "Chowdhury"];
const LAST_NAMES_HINDU = ["Das", "Roy", "Saha", "Sharma", "Biswas", "Talukdar", "Deb"];

// কিছু রিয়েলিস্টিক সাফিক্স, যদি নাম রিপিট হয়ে যায়
const NUMBERS = ["99", "777", "123", "007", "1", "2", "88", "55"];

// --- মেসেজ পুল (English + Banglish) ---
const MESSAGES = [
  "Just bought 5 tickets! 🎟️🔥",
  "Feeling lucky today, let's go!",
  "Bhai 2000 er ticket ase?",
  "Who else is buying for tonight's draw?",
  "Ami matro 3 ta ticket nilam, pray koren.",
  "Wow, the jackpot is huge right now!",
  "Good luck everyone! 🍀",
  "Just bought my first ticket. Fingers crossed.",
  "500 er ticket ki sold out hoye gese?",
  "Let's gooo! Just bought 10 tickets.",
  "I have a good feeling about this one.",
  "Aj rate 12:30 e draw hobe, ready toh?",
  "Bought 3 tickets for me and my friends!",
  "This is my lucky day, I can feel it.",
  "Bhai balance add korte hobe, wait koren.",
  "Don't miss out guys, buy before 6 PM!",
  "Just reloaded my balance and bought tickets 🚀",
  "1000 er ticket nisi, dekhি ki hoy!",
];

const BADGES = [
  { color: "text-green-400", text: "★" },
  { color: "text-blue-400", text: "✦" },
  { color: "text-purple-400", text: "II" },
  { color: "text-yellow-400", text: "III" },
  { color: "text-gray-400", text: "IV" },
];

export default function FakeChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usedUsernames, setUsedUsernames] = useState<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ইউনিক বাংলাদেশি নাম জেনারেট করার ফাংশন
  const generateUniqueUsername = (existing: Set<string>): string => {
    let isUnique = false;
    let newName = "";

    while (!isUnique) {
      // ছেলে না মেয়ে (50% chance)
      const isMale = Math.random() > 0.5;
      const firstName = isMale
        ? FIRST_NAMES_MALE[Math.floor(Math.random() * FIRST_NAMES_MALE.length)]
        : FIRST_NAMES_FEMALE[Math.floor(Math.random() * FIRST_NAMES_FEMALE.length)];

      // হিন্দু না মুসলিম (50% chance)
      const isMuslim = Math.random() > 0.5;
      const lastName = isMuslim
        ? LAST_NAMES_MUSLIM[Math.floor(Math.random() * LAST_NAMES_MUSLIM.length)]
        : LAST_NAMES_HINDU[Math.floor(Math.random() * LAST_NAMES_HINDU.length)];

      // টাইটেল (ডাক্তার, ইঞ্জিনিয়ার ইত্যাদি)
      const title = TITLES[Math.floor(Math.random() * TITLES.length)];

      // পুরো নাম তৈরি
      newName = `${title}${firstName} ${lastName}`;

      // যদি নামটি আগে থেকে থেকে থাকে, তবে শেষে একটি নাম্বার যোগ করা হবে
      if (existing.has(newName)) {
        const num = NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
        newName = `${newName} ${num}`;
      }

      if (!existing.has(newName)) {
        isUnique = true;
      }
    }
    return newName;
  };

  // র‍্যান্ডম মেসেজ জেনারেট করার ফাংশন
  const generateRandomMessage = () => {
    const now = new Date();
    const timeString = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    // ইউনিক ইউজারনেম তৈরি
    const username = generateUniqueUsername(usedUsernames);
    setUsedUsernames((prev) => new Set(prev).add(username));

    // র‍্যান্ডম মেসেজ এবং ব্যাজ সিলেক্ট
    const messageText = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    const badge = BADGES[Math.floor(Math.random() * BADGES.length)];

    const newMessage: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(),
      username: username,
      message: messageText,
      badgeColor: badge.color,
      badgeText: badge.text,
      time: timeString,
    };

    // চ্যাটে মেসেজ যোগ করা (সর্বোচ্চ ৫০টি মেসেজ রাখা হবে)
    setMessages((prev) => [...prev.slice(-49), newMessage]);
  };

  // চ্যাট অটো-স্ক্রল নিচে রাখার জন্য
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // প্রতি ২ থেকে ৫ সেকেন্ড পর পর নতুন মেসেজ আসবে
  useEffect(() => {
    // প্রথমবার লোড হওয়ার সাথে সাথে ৩টি মেসেজ দেখাবে
    const initialTimeouts = [500, 1500, 2500].map((delay) =>
      setTimeout(generateRandomMessage, delay)
    );

    // এরপর র‍্যান্ডম ইন্টারভ্যালে মেসেজ আসতে থাকবে
    const interval = setInterval(() => {
      generateRandomMessage();
    }, Math.random() * 3000 + 2000); // ২ থেকে ৫ সেকেন্ডের মধ্যে

    return () => {
      initialTimeouts.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col font-sans">
      {/* হেডার */}
      <div className="bg-[#1e293b] p-4 border-b border-gray-700 shadow-md flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🇬🇧</span>
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

              {/* ইউজারনেম (রিয়েলিস্টিক বাংলাদেশি নাম) */}
              <span className="font-bold text-gray-200">
                {msg.username}:
              </span>

              {/* মেসেজ */}
              <span className="text-gray-300">
                {msg.message}
              </span>
            </div>
          </div>
        ))}
        {/* অটো স্ক্রলের জন্য খালি ডিভ */}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
