// File: src/app/results-dashboard/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
//import Image from "next/image";
//import renderImg from "@/imgImport";

interface QuestionStats {
  question_id: string;
  question_text: string;
  total_responses: number;
  correct_responses: number;
  percentage_correct: number;
  options: {
    option_id: string;
    option_text: string;
    response_count: number;
    percentage: number;
    is_correct: boolean;
  }[];
}

interface StudentResult {
  student_remote_id: string;
  student_remote_name: string;
  score_obtained: number;
  max_score: number;
  correct_answers: number;
  incorrect_answers: number;
  total_questions: number;
  answered_questions: number;
}

interface DashboardData {
  test_title: string;
  total_students: number;
  total_questions: number;
  average_score: number;
  question_stats: QuestionStats[];
  student_results: StudentResult[];
}

export default function ResultsDashboard() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "students">("questions");

  useEffect(() => {
    // Load results from localStorage
    const savedResults = localStorage.getItem("testResults");
    if (savedResults) {
      const data = JSON.parse(savedResults);
      setDashboardData(data);
    } else {
      // If no data, redirect back to home
      router.push("/");
    }
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-[#4A4A4F]">Loading results...</div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-xl text-[#4A4A4F] mb-4">No test results available</div>
        <button
          onClick={() => router.push("/")}
          className="bg-[#5423E6] text-white px-6 py-2 rounded-lg hover:bg-[#4A1FCC]"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-tthoves-semiBold mb-2">Total Students</h3>
        <p className="text-3xl font-tthoves-bold">{dashboardData.total_students}</p>
      </div>
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-tthoves-semiBold mb-2">Total Questions</h3>
        <p className="text-3xl font-tthoves-bold">{dashboardData.total_questions}</p>
      </div>
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-tthoves-semiBold mb-2">Average Score</h3>
        <p className="text-3xl font-tthoves-bold">{dashboardData.average_score.toFixed(1)}%</p>
      </div>
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-tthoves-semiBold mb-2">Completion Rate</h3>
        <p className="text-3xl font-tthoves-bold">
          {Math.round((dashboardData.student_results.filter(s => s.answered_questions > 0).length / dashboardData.total_students) * 100)}%
        </p>
      </div>
    </div>
  );

  const renderQuestionStats = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6">
        <h3 className="text-lg font-tthoves-semiBold text-blue-800 mb-2">Question Performance Overview</h3>
        <p className="text-blue-700">Below you`&apos;`ll find the percentage of students who answered each question correctly.</p>
      </div>
      
      {dashboardData.question_stats.map((question, index) => (
        <div key={question.question_id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="text-lg font-tthoves-semiBold text-[#4A4A4F] mb-2">
                  Question {index + 1}
                </h4>
                <p className="text-[#4A4A4F] font-tthoves">{question.question_text}</p>
              </div>
              <div className="ml-6 text-right">
                <div className={`inline-flex items-center px-4 py-2 rounded-full text-2xl font-tthoves-bold ${
                  question.percentage_correct >= 70 
                    ? 'bg-green-100 text-green-800' 
                    : question.percentage_correct >= 50 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {Math.round(question.percentage_correct)}%
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {question.correct_responses}/{question.total_responses} correct
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <h5 className="font-tthoves-semiBold text-[#4A4A4F] mb-4">Answer Breakdown:</h5>
            <div className="space-y-3">
              {question.options.map((option) => (
                <div key={option.option_id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-3 ${
                      option.is_correct ? 'bg-green-500' : 'bg-gray-300'
                    }`}></span>
                    <span className="text-[#4A4A4F] font-tthoves">
                      {option.option_text}
                      {option.is_correct && <span className="ml-2 text-green-600 text-sm">(Correct)</span>}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-[#4A4A4F] font-tthoves mr-3">
                      {option.response_count} responses
                    </span>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          option.is_correct ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.max(option.percentage, 2)}%` }}
                      ></div>
                    </div>
                    <span className="ml-2 text-sm text-gray-600 w-12 text-right">
                      {Math.round(option.percentage)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderStudentResults = () => (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#5423E6] text-white">
              <th className="border border-gray-200 p-4 text-left font-tthoves font-medium">Student Name</th>
              <th className="border border-gray-200 p-4 text-center font-tthoves font-medium">Score</th>
              <th className="border border-gray-200 p-4 text-center font-tthoves font-medium">Percentage</th>
              <th className="border border-gray-200 p-4 text-center font-tthoves font-medium">Correct</th>
              <th className="border border-gray-200 p-4 text-center font-tthoves font-medium">Incorrect</th>
              <th className="border border-gray-200 p-4 text-center font-tthoves font-medium">Answered</th>
            </tr>
          </thead>
          <tbody>
            {dashboardData.student_results
              .sort((a, b) => (b.score_obtained / b.max_score) - (a.score_obtained / a.max_score))
              .map((student, index) => (
              <tr key={student.student_remote_id} className="hover:bg-gray-50">
                <td className="border border-gray-200 p-4">
                  <div className="flex items-center">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mr-3 ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="font-tthoves text-[#4A4A4F]">{student.student_remote_name}</span>
                  </div>
                </td>
                <td className="border border-gray-200 p-4 text-center font-tthoves text-[#4A4A4F]">
                  {student.score_obtained}/{student.max_score}
                </td>
                <td className="border border-gray-200 p-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-sm font-tthoves-semiBold ${
                    (student.score_obtained / student.max_score) * 100 >= 70 
                      ? 'bg-green-100 text-green-800' 
                      : (student.score_obtained / student.max_score) * 100 >= 50 
                      ? 'bg-yellow-100 text-yellow-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {Math.round((student.score_obtained / student.max_score) * 100)}%
                  </span>
                </td>
                <td className="border border-gray-200 p-4 text-center">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-tthoves-semiBold">
                    {student.correct_answers}
                  </span>
                </td>
                <td className="border border-gray-200 p-4 text-center">
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-tthoves-semiBold">
                    {student.incorrect_answers}
                  </span>
                </td>
                <td className="border border-gray-200 p-4 text-center">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-tthoves-semiBold">
                    {student.answered_questions}/{student.total_questions}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-tthoves-bold text-[#4A4A4F] mb-2">
                Test Results Dashboard
              </h1>
              <p className="text-[#4A4A4F] font-tthoves">
                {dashboardData.test_title}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push("/test-screen")}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg font-tthoves hover:bg-gray-600 transition-colors"
              >
                Back to Test
              </button>
              <button
                onClick={() => router.push("/")}
                className="bg-[#5423E6] text-white px-6 py-2 rounded-lg font-tthoves hover:bg-[#4A1FCC] transition-colors"
              >
                Home
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="flex border-b border-gray-200">
            {[
              { key: "questions", label: "Question Analysis", icon: "📊" },
              { key: "overview", label: "Overview", icon: "📈" },
              { key: "students", label: "Student Results", icon: "👥" }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as "overview" | "questions" | "students")}
                className={`flex-1 px-6 py-4 text-center font-tthoves transition-colors ${
                  activeTab === tab.key
                    ? 'text-[#5423E6] border-b-2 border-[#5423E6] bg-blue-50'
                    : 'text-[#4A4A4F] hover:text-[#5423E6] hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          {activeTab === "overview" && renderOverview()}
          {activeTab === "questions" && renderQuestionStats()}
          {activeTab === "students" && renderStudentResults()}
        </div>
      </div>
    </div>
  );
}