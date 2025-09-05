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
  questions_presented?: number;
  average_score: number;
  question_stats: QuestionStats[];
  student_results: StudentResult[];
  is_partial_test?: boolean;
  completion_status?: string;
}

export default function ResultsDashboard() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "students">("questions");

  useEffect(() => {
    // Load results from localStorage
    const savedResults = localStorage.getItem("testResults");
    console.log('Raw saved results:', savedResults); // Debug log
    
    if (savedResults) {
      const data = JSON.parse(savedResults);
      console.log('Parsed dashboard data:', data); // Debug log
      console.log('Student results length:', data.student_results?.length); // Debug log
      setDashboardData(data);
    } else {
      console.log('No saved results found'); // Debug log
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

  const renderOverview = () => {
    const questionsPresented = dashboardData.questions_presented || dashboardData.total_questions;
    const hasStudentData = dashboardData.student_results && dashboardData.student_results.length > 0;
    const studentsWithResponses = hasStudentData 
      ? dashboardData.student_results.filter(s => s.answered_questions > 0)
      : [];
    
    const completionRate = dashboardData.total_students > 0 
      ? (studentsWithResponses.length / dashboardData.total_students) * 100 
      : 0;

    console.log('Render overview - hasStudentData:', hasStudentData); // Debug log
    console.log('Students with responses:', studentsWithResponses.length); // Debug log

    return (
      <div className="space-y-6">
        {/* Partial Test Warning */}
        {dashboardData.is_partial_test && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Partial Test Results</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>This test was stopped early. Results show data for {questionsPresented} out of {dashboardData.total_questions} questions.</p>
                  <p className="mt-1">{dashboardData.completion_status}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-tthoves-semiBold mb-2">Total Students</h3>
            <p className="text-3xl font-tthoves-bold">{dashboardData.total_students}</p>
            <p className="text-sm opacity-80 mt-1">{studentsWithResponses.length} participated</p>
          </div>
          
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-tthoves-semiBold mb-2">Questions</h3>
            <p className="text-3xl font-tthoves-bold">{questionsPresented}</p>
            <p className="text-sm opacity-80 mt-1">
              {dashboardData.is_partial_test 
                ? `of ${dashboardData.total_questions} total` 
                : 'completed'
              }
            </p>
          </div>
          
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-tthoves-semiBold mb-2">Average Score</h3>
            <p className="text-3xl font-tthoves-bold">
              {isNaN(dashboardData.average_score) ? '0.0' : dashboardData.average_score.toFixed(1)}%
            </p>
            <p className="text-sm opacity-80 mt-1">
              {studentsWithResponses.length > 0 ? `${studentsWithResponses.length} students` : 'No responses'}
            </p>
          </div>
          
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-tthoves-semiBold mb-2">Participation Rate</h3>
            <p className="text-3xl font-tthoves-bold">{Math.round(completionRate)}%</p>
            <p className="text-sm opacity-80 mt-1">Students who responded</p>
          </div>
        </div>

        {/* Additional Statistics for Partial Tests */}
        {dashboardData.is_partial_test && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-tthoves-semiBold text-[#4A4A4F] mb-4">Test Progress Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-tthoves-bold text-blue-600">{questionsPresented}</div>
                <div className="text-sm text-blue-800">Questions Presented</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-tthoves-bold text-gray-600">{dashboardData.total_questions - questionsPresented}</div>
                <div className="text-sm text-gray-800">Questions Skipped</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-tthoves-bold text-green-600">
                  {Math.round((questionsPresented / dashboardData.total_questions) * 100)}%
                </div>
                <div className="text-sm text-green-800">Test Completion</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderQuestionStats = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6">
        <h3 className="text-lg font-tthoves-semiBold text-blue-800 mb-2">Question Performance Overview</h3>
        <p className="text-blue-700">Below you&apos;ll find the percentage of students who answered each question correctly.</p>
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

  const renderStudentResults = () => {
    const hasStudentData = dashboardData.student_results && dashboardData.student_results.length > 0;
    const studentsWithResponses = hasStudentData 
      ? dashboardData.student_results.filter(s => s.answered_questions > 0)
      : [];

    console.log('Render student results - hasStudentData:', hasStudentData); // Debug log
    console.log('Students with responses count:', studentsWithResponses.length); // Debug log

    if (!hasStudentData) {
      return (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h3 className="text-lg font-tthoves-semiBold text-[#4A4A4F] mb-2">No Student Data Available</h3>
          <p className="text-[#4A4A4F] font-tthoves">
            No student responses were recorded for this test session.
          </p>
          {dashboardData.is_partial_test && (
            <p className="text-sm text-gray-600 mt-2">
              This may be because the test was stopped before students could respond.
            </p>
          )}
          <div className="mt-4 text-sm text-gray-500">
            Expected {dashboardData.total_students} students, got {dashboardData.student_results?.length || 0} records
          </div>
        </div>
      );
    }

    if (studentsWithResponses.length === 0) {
      return (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="text-yellow-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-tthoves-semiBold text-[#4A4A4F] mb-2">No Student Responses</h3>
          <p className="text-[#4A4A4F] font-tthoves">
            Students were registered but no responses were recorded.
          </p>
          <div className="mt-4 text-sm text-gray-600">
            <p>Total students: {dashboardData.total_students}</p>
            <p>Students who responded: 0</p>
            <p>Student records found: {dashboardData.student_results.length}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {studentsWithResponses.length < dashboardData.total_students && (
          <div className="bg-yellow-50 border-b border-yellow-200 p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Only showing {studentsWithResponses.length} of {dashboardData.total_students} students who provided responses.
            </p>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#5423E6] text-white">
                <th className="border border-gray-200 p-4 text-left font-tthoves font-medium">Student Name</th>
                <th className="border border-gray-200 p-4 text-center font-tthoves font-medium">Score</th>
                <th className="border border-gray-200 p-4 text-center font-tthoves font-medium">Percentage</th>
                <th className="border border-gray-200 p-4 text-center font-tthoves font-medium">Correct</th>
                <th className="border border-gray-200 p-4 text-center font-tthoves font-medium">Incorrect</th>
                <th className="border border-gray-200 p-4 text-center font-tthoves font-medium">Unanswered</th>
                <th className="border border-gray-200 p-4 text-center font-tthoves font-medium">Answered</th>
              </tr>
            </thead>
            <tbody>
              {studentsWithResponses
                .sort((a, b) => (b.score_obtained / (b.max_score || 1)) - (a.score_obtained / (a.max_score || 1)))
                .map((student, index) => {
                  // Calculate unanswered questions
                  const unansweredQuestions = student.total_questions - student.answered_questions;
                  
                  // Calculate incorrect answered questions (not including unanswered)
                  const incorrectAnsweredQuestions = student.answered_questions - student.correct_answers;
                  
                  return (
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
                          (student.max_score > 0 ? (student.score_obtained / student.max_score) * 100 : 0) >= 70 
                            ? 'bg-green-100 text-green-800' 
                            : (student.max_score > 0 ? (student.score_obtained / student.max_score) * 100 : 0) >= 50 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {student.max_score > 0 ? Math.round((student.score_obtained / student.max_score) * 100) : 0}%
                        </span>
                      </td>
                      <td className="border border-gray-200 p-4 text-center">
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-tthoves-semiBold">
                          {student.correct_answers}
                        </span>
                      </td>
                      <td className="border border-gray-200 p-4 text-center">
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-tthoves-semiBold">
                          {incorrectAnsweredQuestions}
                        </span>
                      </td>
                      <td className="border border-gray-200 p-4 text-center">
                        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-sm font-tthoves-semiBold">
                          {unansweredQuestions}
                        </span>
                      </td>
                      <td className="border border-gray-200 p-4 text-center">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-tthoves-semiBold">
                          {student.answered_questions}/{student.total_questions}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        
        {/* Legend for the different categories */}
        <div className="bg-gray-50 p-4 border-t border-gray-200">
          <h4 className="text-sm font-tthoves-semiBold text-[#4A4A4F] mb-3">Legend:</h4>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-tthoves-semiBold">
                Correct
              </span>
              <span className="text-gray-600">Questions answered correctly</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-tthoves-semiBold">
                Incorrect
              </span>
              <span className="text-gray-600">Questions answered incorrectly</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-tthoves-semiBold">
                Unanswered
              </span>
              <span className="text-gray-600">Questions not answered (time expired)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-tthoves-semiBold">
                Answered
              </span>
              <span className="text-gray-600">Total questions attempted</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

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