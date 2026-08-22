"use client"
import Image from "next/image";
import Link from 'next/link'
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Menu, X, Search, FileText } from 'lucide-react';
import { useRef } from "react";
import { FileInput } from "../components/FileInput";


   
export default function Home() {
  const [filter, setFilter] = React.useState("");
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
   const router = useRouter();
   
    const handleFileSelect = async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        console.log("File uploaded successfully");
      } else {
        console.error("File upload failed");
      }
    };


    const handleLogout = async (e: React.FormEvent) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // IMPORTANT — send/receive cookies
    });
    if (res.ok) {
      console.log("Logged out");
      router.push("/login");
    } else {
      console.error("Logout failed");
    };
  }
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-16 bg-white flex items-center justify-between px-4 md:px-8 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
          <h2 className="text-xl font-bold text-blue-600">Welcome</h2>
        </div>

        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400 size-5" />
            <input
              type="text"
              placeholder="Search files..."
              className="w-full h-10 rounded-xl bg-gray-50 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>
        
        <div className="w-10 h-10 bg-gray-200 rounded-full hidden sm:block"></div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className={`
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 fixed md:relative top-16 md:top-0 bottom-0 md:bottom-auto left-0 z-10 w-64 bg-white overflow-y-auto
          transition-transform duration-300 ease-in-out
        `}>
          <nav className="p-4 space-y-5">
              <FileInput onFileSelect={file => handleFileSelect(file)}
                buttonText="Upload File"
                containerClassName="w-full"
                buttonClassName="w-full text-left px-4 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors"
              />
            {['Shared with me', 'Recent', 'Favorites', 'Trash'].map((item) => (
              <button key={item} className="w-full text-left px-4 py-3 rounded-xl text-gray-600 hover:bg-blue-50 hover:text-blue-600 font-medium transition-colors">
                {item}
              </button>
            ))}
            <button 
              onClick={handleLogout}
              className="w-full mt-10 text-left px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 font-medium transition-colors"
            >
              Logout
            </button>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">Your Files</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                    <FileText />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Project_Report_{i}.pdf</span>
                </div>
              ))}
            </div>
          </div>
        </main>

        {isMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-0 md:hidden" 
            onClick={() => setIsMenuOpen(false)}
          />
        )}
      </div>
    </div>
  );
  
}

export const dynamic = 'force-dynamic';


