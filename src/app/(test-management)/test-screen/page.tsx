"use client";
import Image from "next/image";
import renderImg from "@/imgImport";
import React, { useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import init, { decrypt } from "snappy-remote";
import { useRouter } from "next/navigation";
import { getOS } from "@/utils/getPlatform";
import questionsData from "./questions.json";

interface Option {
  option_id: string;
  option_text: string;
  content: string;
  isCorrect: boolean;
}
interface USBDeviceEvent extends Event {
  device: USBDevice;
}
interface Question {
  question_id: string;
  question_text: string;
  content: string;
  format: "mcq" | "code" | "descriptive";
  answer_text: string | null;
  options: Option[];
}
interface TestData {
  test_id: string;
  title: string;
  points: number;
  test_type: string;
  order: number | null;
  questions: Question[];
}
interface RemoteResponse {
  student_remote_id: string;
  student_remote_response: string;
  timestamp: number;
}
interface QuestionResponse {
  question_id: string;
  responses: RemoteResponse[];
}
interface RootState {
  remote: {
    receivers: {
      receiverID: string;
      receiverName: string;
      remotes: { remote_id: string; remote_name: string }[];
    }[];
    currentReceiver: string;
  };
}

const dummyTestData: TestData = questionsData as TestData;

export default function TestScreen() {
  const { receivers, currentReceiver } = useSelector(
    (state: RootState) => state.remote
  );
  const router = useRouter();
  const platform = getOS();

  const receiver = receivers.find(
    (receiver) => receiver.receiverID === currentReceiver
  );
  const [error, setError] = useState<string | null>(null);
  const [testData, setTestData] = useState<TestData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [phase, setPhase] = useState<"collecting" | "displaying">("collecting");
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [allRemotes, setAllRemotes] = useState<
    {
      student_remote_id: string;
      student_remote_mac_id: string;
      student_remote_name: string;
    }[]
  >([]);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [usbConnected, setUsbConnected] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const usbListeningRef = useRef<boolean>(false);
  const deviceRef = useRef<USBDevice | null>(null);
  const currentQuestionIndexRef = useRef<number>(0);

  const [progress, setProgress] = useState<
    {
      student_remote_id: string;
      student_remote_name: string;
      score_obtained: number;
      max_score: number;
      correct_answers: number;
      incorrect_answers: number;
      total_questions: number;
      answered_questions: number;
      answer_details: {
        question_id: string;
        question_text: string;
        selected_option_id: string | null;
        selected_option_text: string | null;
        correct_option_id: string;
        correct_option_text: string;
        is_correct: boolean;
        timestamp: number | null;
      }[];
    }[]
  >([]);

  // Function to load questions from JSON file
  const loadQuestionsFromJSON = (): TestData => {
    return dummyTestData;
  };

  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  useEffect(() => {
    async function initialize() {
      try {
        await init();
      } catch (initError) {
        console.error("Initialization error:", initError);
      }
    }
    initialize();
  }, []);

  useEffect(() => {
    const handleDisconnect = (event: USBDeviceEvent) => {
      setUsbConnected(false);
      setError("USB device disconnected. Please reconnect to continue." + event.device.serialNumber);
      usbListeningRef.current = false;
      deviceRef.current = null;
    };

    navigator.usb.addEventListener("disconnect", handleDisconnect);
    return () =>
      navigator.usb.removeEventListener("disconnect", handleDisconnect);
  }, []);

  async function getAndOpenDevice(): Promise<USBDevice> {
    try {
      const deviceInfo = JSON.parse(
        localStorage.getItem("currentDeviceInfo") || "{}"
      );
      if (!deviceInfo.vendorId || !deviceInfo.productId) {
        throw new Error("No device information found in localStorage.");
      }

      const devices = await navigator.usb.getDevices();

      const device = devices.find(
        (d) =>
          d.vendorId === deviceInfo.vendorId &&
          d.productId === deviceInfo.productId &&
          (!deviceInfo.serialNumber ||
            d.serialNumber === deviceInfo.serialNumber)
      );

      if (!device) {
        throw new Error("Device not found or not authorized.");
      }

      if (!device.opened) {
        await device.open();
      }

      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      await device.claimInterface(1);

      return device;
    } catch (error: unknown) {
      console.error("Error retrieving device:", error);
      throw error;
    }
  }

  async function connectToUSBDevice() {
    if (usbConnected && usbListeningRef.current) {
      return;
    }

    setError(null);

    try {
      if (!("usb" in navigator)) {
        throw new Error("Web USB API is not supported in this browser.");
      }

      deviceRef.current = await getAndOpenDevice();
      const serialNumber = deviceRef.current.serialNumber || "";
      const command = new TextEncoder().encode("START\n");
      const descriptorIndex = serialNumber ? 0 : 3;
      const result = await deviceRef.current.controlTransferIn(
        {
          requestType: "standard",
          recipient: "device",
          request: 0x06,
          value: (0x03 << 8) | descriptorIndex,
          index: 0x0409,
        },
        255
      );

      if (!result.data) {
        throw new Error("No data received from control transfer");
      }

      let serial_number: Uint8Array;
      if (platform === "windows") {
        if (!result.data) {
          throw new Error("No data received from controlTransferIn");
        }
        const serialKey = new Uint8Array(result.data.buffer);
        const serialArray: number[] = [];
        for (let i = 2; i < serialKey.length; i += 2) {
          serialArray.push(serialKey[i]);
        }
        serial_number = new Uint8Array(serialArray);
      } else {
        const serialNumber = deviceRef.current.serialNumber || "";
        serial_number = new Uint8Array(
          [...serialNumber].map((char) => char.charCodeAt(0))
        );
      }

      await deviceRef.current.transferOut(2, command);

      setUsbConnected(true);
      setError(null);
      usbListeningRef.current = true;

      while (true) {
        try {
          const result = await deviceRef.current.transferIn(2, 64);

          if (result.status === "ok" && result.data) {
            if (phase === "collecting") {
              const int8Array = new Uint8Array(result.data.buffer);
              if (int8Array.length === 17) {
                const data = new Uint8Array([...int8Array.slice(0, 17)]);
                const answer = decrypt(serial_number, data);
                if (
                  typeof answer === "string" &&
                  answer.trim().startsWith("{")
                ) {
                  try {
                    const jsonData: { MAC: string; value: number } =
                      JSON.parse(answer);
                    const currentIndex = currentQuestionIndexRef.current;
                    const currentQuestionId =
                      testData?.questions[currentIndex]?.question_id;

                    if (
                      jsonData.MAC &&
                      jsonData.value !== undefined &&
                      currentQuestionId
                    ) {
                      const matchingRemote = allRemotes.find(
                        (remote) =>
                          remote?.student_remote_mac_id === jsonData.MAC
                      );

                      if (matchingRemote) {
                        // Map button value (1,2,3,4) to option index (0,1,2,3) then to option_id
                        const buttonIndex = jsonData.value - 1; // Convert 1,2,3,4 to 0,1,2,3
                        const selectedOption = testData?.questions[currentIndex].options[buttonIndex];

                        const newResponse: RemoteResponse = {
                          student_remote_id: matchingRemote.student_remote_id,
                          student_remote_response: selectedOption?.option_id || `option_${jsonData.value}`,
                          timestamp: Date.now(),
                        };
                        setResponses((prev) => {
                          const existingQuestion = prev.find(
                            (q) => q.question_id === currentQuestionId
                          );

                          if (existingQuestion) {
                            // Remove any existing response from this remote and add the new one
                            const updatedResponses = existingQuestion.responses.filter(
                              (r) => r.student_remote_id !== newResponse.student_remote_id
                            );
                            updatedResponses.push(newResponse);
                            
                            return prev.map((q) =>
                              q.question_id === currentQuestionId
                                ? {
                                    ...q,
                                    responses: updatedResponses,
                                  }
                                : q
                            );
                          }
                          return [
                            ...prev,
                            {
                              question_id: currentQuestionId,
                              responses: [newResponse],
                            },
                          ];
                        });
                      }
                    }
                  } catch (parseError) {
                    console.error(
                      "JSON parse error:",
                      parseError,
                      "Input:",
                      answer
                    );
                  }
                }
              }
            } else {
              console.log(
                "Ignoring response: Not in collecting phase (current phase:",
                phase,
                ")"
              );
            }
          }
        } catch (loopError) {
          console.error("Error in USB listening loop:", loopError);
          setError("Error receiving USB data. Please reconnect the device.");
          usbListeningRef.current = false;
          break;
        }
      }
    } catch (error: unknown) {
      console.error("Error:", error);
      setError("Failed to connect to USB device. Please try again.");
      usbListeningRef.current = false;
      setUsbConnected(false);
    } finally {
      if (deviceRef.current && deviceRef.current.opened) {
        try {
          await deviceRef.current.close();
        } catch (closeError) {
          console.error("Error closing device:", closeError);
        }
      }
    }
  }

  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      setIsFullscreen(true);
      document.documentElement.requestFullscreen().catch((err) => {
        setFullscreenError("Failed to enter fullscreen. Please try again." + err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        setFullscreenError("Failed to exit fullscreen. Please try again." + err);
      });
      setIsFullscreen(false);
    }
  };

  const handleNext = () => {
    if (!testData) return;
    if (currentQuestionIndex < testData.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setPhase("collecting");
      setTimeLeft(30);
      usbListeningRef.current = true; // Restart listening for next question
      connectToUSBDevice(); // Reconnect for the next question
    } else {
      handleSubmit();
      setShowCompletionModal(true);
    }
  };

  const handleSubmit = () => {
    if (!testData) return;

    // Create detailed answer mapping for each student
    const answerMappings: {
      [studentId: string]: {
        student_name: string;
        answers: {
          question_id: string;
          question_text: string;
          selected_option_id: string | null;
          selected_option_text: string | null;
          correct_option_id: string;
          correct_option_text: string;
          is_correct: boolean;
          timestamp: number | null;
        }[];
      };
    } = {};

    // Initialize answer mappings for all students
    allRemotes.forEach((remote) => {
      answerMappings[remote.student_remote_id] = {
        student_name: remote.student_remote_name,
        answers: [],
      };

      // Process each question
      testData.questions.forEach((question) => {
        const correctOption = question.options.find(opt => opt.isCorrect);
        const questionResponse = responses.find(
          (qr) => qr.question_id === question.question_id
        );
        
        // Get the latest response for this student and question (based on timestamp)
        let studentResponse = null;
        if (questionResponse) {
          const studentResponses = questionResponse.responses.filter(
            (r) => r.student_remote_id === remote.student_remote_id
          );
          if (studentResponses.length > 0) {
            // Sort by timestamp and take the latest one
            studentResponse = studentResponses.sort((a, b) => b.timestamp - a.timestamp)[0];
          }
        }

        const selectedOption = studentResponse
          ? question.options.find(opt => opt.option_id === studentResponse.student_remote_response)
          : null;

        const isCorrect = selectedOption ? selectedOption.isCorrect : false;

        answerMappings[remote.student_remote_id].answers.push({
          question_id: question.question_id,
          question_text: question.question_text,
          selected_option_id: selectedOption?.option_id || null,
          selected_option_text: selectedOption?.option_text || null,
          correct_option_id: correctOption?.option_id || "",
          correct_option_text: correctOption?.option_text || "",
          is_correct: isCorrect,
          timestamp: studentResponse?.timestamp || null,
        });
      });
    });

    // Calculate progress based on answer mappings
    const simulatedProgress = allRemotes.map((remote) => {
      const studentAnswers = answerMappings[remote.student_remote_id].answers;
      const correctAnswers = studentAnswers.filter(answer => answer.is_correct).length;
      const answeredQuestions = studentAnswers.filter(answer => answer.selected_option_id !== null).length;
      const incorrectAnswered = studentAnswers.filter(answer => answer.selected_option_id !== null && !answer.is_correct).length;
      const unansweredQuestions = testData.questions.length - answeredQuestions;
      const totalIncorrect = incorrectAnswered + unansweredQuestions;

      return {
        student_remote_id: remote.student_remote_id,
        student_remote_name: remote.student_remote_name,
        score_obtained: correctAnswers * 10,
        max_score: testData.questions.length * 10,
        correct_answers: correctAnswers,
        incorrect_answers: totalIncorrect,
        total_questions: testData.questions.length,
        answered_questions: answeredQuestions,
        answer_details: studentAnswers,
      };
    });

    setProgress(simulatedProgress);
  };

  const renderQuestion = (question: Question) => {
    const currentResponses =
      responses.find((r) => r.question_id === question.question_id)
        ?.responses || [];

    const gridCols = Math.min(Math.max(allRemotes.length, 4), 8);

    if (phase === "collecting") {
      return (
        <div className="w-full h-full bg-white">
          <h3 className="text-xl font-tthoves text-[#4A4A4F] mb-6">
            {question.question_text}
          </h3>
          <div className="space-y-3 mb-8">
            {question.options.map((option, index) => (
              <div
                key={option.option_id}
                className="flex items-center rounded-xl space-x-3 py-4 px-6 border-[2px] border-[#E3E3E4] bg-white"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#5423E6] text-white flex items-center justify-center font-semibold">
                  {String.fromCharCode(65 + index)}
                </div>
                <span className="text-lg text-[#4A4A4F] font-tthoves">{option.option_text}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg">
            <div className="text-lg font-tthoves p-4 text-[#4A4A4F] w-full rounded-lg bg-blue-100">
              Collecting responses... ({timeLeft}s)
              <ul className={`list-disc pl-5 grid grid-cols-${gridCols} mt-4`}>
                {allRemotes.map((remote, index) => {
                  const matchingResponse = currentResponses.find(
                    (response) =>
                      response.student_remote_id === remote.student_remote_id
                  );
                  const isMatchingId = !!matchingResponse;
                  return (
                    <li
                      key={index}
                      className={`${
                        isMatchingId ? "bg-yellow-200 p-1 rounded" : "p-1"
                      } flex items-center gap-3`}
                    >
                      <div className="flex items-center gap-2 border-2 border-[#E3E3E4] rounded-xl p-4 bg-white">
                        Student: {remote.student_remote_name || "Unknown"},
                        {isMatchingId ? (
                          <button
                            type="button"
                            className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                          >
                            ✓
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="bg-gray-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                          >
                            ✗
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="w-full h-full relative bg-white">
        <div className="w-full">
          <h3 className="text-xl font-tthoves text-[#4A4A4F] mb-6">
            {question.question_text}
          </h3>
          <div className="space-y-3 mb-8">
            {question.options.map((option, index) => (
              <div
                key={option.option_id}
                className="flex items-center rounded-xl space-x-3 py-4 px-6 border-[2px] border-[#E3E3E4] bg-white"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#5423E6] text-white flex items-center justify-center font-semibold">
                  {String.fromCharCode(65 + index)}
                </div>
                <span className="text-lg text-[#4A4A4F] font-tthoves">{option.option_text}</span>
              </div>
            ))}
          </div>
          <div className="w-full rounded-lg">
            {currentResponses.length > 0 ? (
              <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                <h4 className="text-lg font-tthoves text-[#4A4A4F]">
                  Responses for Question {currentQuestionIndex + 1}:
                </h4>
                <ul className={`list-disc pl-5 grid grid-cols-${gridCols} mt-4`}>
                  {allRemotes.map((remote, index) => {
                    const matchingResponse = currentResponses.find(
                      (response) =>
                        response.student_remote_id === remote.student_remote_id
                    );
                    const isMatchingId = !!matchingResponse;
                    return (
                      <li
                        key={index}
                        className={`${
                          isMatchingId ? "bg-yellow-200 p-1 rounded" : "p-1"
                        } flex items-center gap-3`}
                      >
                        <div className="flex items-center gap-2 border-2 border-[#E3E3E4] rounded-xl p-4 bg-white">
                          Student: {remote.student_remote_name || "Unknown"},
                          {isMatchingId ? (
                            <button
                              type="button"
                              className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                            >
                              ✓
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="bg-gray-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                            >
                              ✗
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                <p className="text-lg font-tthoves text-[#4A4A4F]">
                  No responses received for this question.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Load questions and set up remotes
  useEffect(() => {
    const questionsData = loadQuestionsFromJSON();
    setTestData(questionsData);
  }, []);

  useEffect(() => {
    if (receiver?.remotes) {
      // Filter out remote 1 (teacher remote - first item in array)
      const transformedRemotes = receiver.remotes.slice(1).map((remote) => ({
        student_remote_id: remote.remote_id,
        student_remote_mac_id: remote.remote_id,
        student_remote_name: remote.remote_name,
      }));
      setAllRemotes(transformedRemotes);
    } else {
      setAllRemotes([]);
    }
  }, [receiver]);

  useEffect(() => {
    if (
      !testData ||
      !usbConnected ||
      phase !== "collecting" ||
      showCompletionModal
    ) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setPhase("displaying");
          usbListeningRef.current = false; // Stop listening when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [testData, usbConnected, phase, showCompletionModal]);

  useEffect(() => {
    if (!document.fullscreenElement && document.fullscreenEnabled) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.log("Error entering fullscreen on load:", err);
        setFullscreenError(
          "Could not enter fullscreen automatically. Please click the fullscreen button to continue."
        );
      });
      setIsFullscreen(true);
    }
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500 text-lg">Error: {error}</div>
      </div>
    );
  }

  if (!testData || !testData.questions || testData.questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-red-500">No questions available</div>
      </div>
    );
  }

  if (!usbConnected || !isFullscreen) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-tthoves text-[#4A4A4F] mb-4">
            Prepare to Start Test
          </h2>
          <p className="text-lg text-[#4A4A4F] mb-6">
            Please connect the USB device and enter fullscreen mode to start the
            test.
          </p>
          {!usbConnected && isFullscreen && (
            <button
              type="button"
              onClick={connectToUSBDevice}
              className="bg-[#5423E6] text-white px-6 py-2 rounded-lg mb-4"
            >
              Connect USB Device
            </button>
          )}
          {!isFullscreen && (
            <button
              type="button"
              onClick={handleFullscreenToggle}
              className="bg-[#5423E6] text-white px-6 py-2 rounded-lg"
            >
              {usbConnected
                ? "To start test, Fullscreen mode is required."
                : "Next"}
            </button>
          )}
          {fullscreenError && !isFullscreen && (
            <div className="mt-4 text-red-500">{fullscreenError}</div>
          )}
          {error && usbConnected && (
            <div className="mt-4 text-red-500">{error}</div>
          )}
        </div>
      </div>
    );
  }

  const currentQuestion = testData.questions[currentQuestionIndex];

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-4 bg-white">
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-4xl w-full">
            <h2 className="text-3xl font-tthoves font-semibold text-[#4A4A4F] mb-6 text-center">
              Test Results
            </h2>
            {progress.length > 0 ? (
              <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse border border-gray-200">
                  <thead>
                    <tr className="bg-[#5423E6] text-white">
                      <th className="border border-gray-200 p-3 text-left font-tthoves font-medium">
                        Student Name
                      </th>
                      <th className="border border-gray-200 p-3 text-left font-tthoves font-medium">
                        Remote ID
                      </th>
                      <th className="border border-gray-200 p-3 text-center font-tthoves font-medium">
                        Correct Answers
                      </th>
                      <th className="border border-gray-200 p-3 text-center font-tthoves font-medium">
                        Incorrect Answers
                      </th>
                      <th className="border border-gray-200 p-3 text-center font-tthoves font-medium">
                        Total Questions
                      </th>
                      <th className="border border-gray-200 p-3 text-center font-tthoves font-medium">
                        Answered Questions
                      </th>
                      <th className="border border-gray-200 p-3 text-center font-tthoves font-medium">
                        Score
                      </th>
                      <th className="border border-gray-200 p-3 text-center font-tthoves font-medium">
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.map((item) => (
                      <tr
                        key={item.student_remote_id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="border border-gray-200 p-3 text-[#4A4A4F] font-tthoves">
                          {item.student_remote_name || "Unknown"}
                        </td>
                        <td className="border border-gray-200 p-3 text-[#4A4A4F] font-tthoves">
                          {item.student_remote_id}
                        </td>
                        <td className="border border-gray-200 p-3 text-center font-tthoves">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-semibold">
                            {item.correct_answers}
                          </span>
                        </td>
                        <td className="border border-gray-200 p-3 text-center font-tthoves">
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-semibold">
                            {item.incorrect_answers}
                          </span>
                        </td>
                        <td className="border border-gray-200 p-3 text-center text-[#4A4A4F] font-tthoves">
                          {item.total_questions}
                        </td>
                        <td className="border border-gray-200 p-3 text-center font-tthoves">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-semibold">
                            {item.answered_questions}
                          </span>
                        </td>
                        <td className="border border-gray-200 p-3 text-center text-[#4A4A4F] font-tthoves font-semibold">
                          {item.score_obtained}/{item.max_score}
                        </td>
                        <td className="border border-gray-200 p-3 text-center font-tthoves">
                          <span className={`px-2 py-1 rounded-full text-sm font-semibold ${
                            (item.score_obtained / item.max_score) * 100 >= 70
                              ? 'bg-green-100 text-green-800'
                              : (item.score_obtained / item.max_score) * 100 >= 50
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {Math.round((item.score_obtained / item.max_score) * 100)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-lg text-[#4A4A4F] font-tthoves mb-6">
                No results available. No responses were recorded.
              </div>
            )}
            <div className="text-center">
              <p className="text-lg text-[#4A4A4F] font-tthoves mb-6">
                You have completed the test. Click below to return to the
                dashboard.
              </p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="bg-[#5423E6] text-white px-8 py-3 rounded-lg font-tthoves hover:bg-[#4A1FCC] transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="w-full p-6 rounded-lg mb-20">
        <div className="mb-4 flex justify-between items-center">
          <div className="text-[#4A1FCC] font-tthoves-semiBold text-2xl">
            Question {currentQuestionIndex + 1}
          </div>
          <div className="flex items-center gap-4">
            {phase === "collecting" && (
              <div className="text-[#4A4A4F] font-tthoves text-lg">
                Time Left: {timeLeft}s
              </div>
            )}
            <button
              type="button"
              onClick={handleFullscreenToggle}
              className="text-[#4A4A4F] font-tthoves text-lg"
            >
              {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            </button>
          </div>
        </div>
        <div className="w-full h-[1px] bg-[#E3E3E4] my-3" />
        <div className="h-full">{renderQuestion(currentQuestion)}</div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex justify-between items-center">
        <button
          type="button"
          className="text-[#4A4A4F] font-tthoves-semiBold text-lg flex items-center justify-center gap-1"
          onClick={() => router.push("/")}
        >
          Exit Test
          <Image
            src={renderImg("logout")}
            alt="Logout"
            width={20}
            height={20}
            className="ml-2"
          />
        </button>
        <div className="mt-4">
          <button
            type="button"
            onClick={handleNext}
            className="bg-[#5423E6] text-white px-6 py-2 rounded-lg flex items-center gap-2"
          >
            {currentQuestionIndex < testData!.questions.length - 1
              ? "Next"
              : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}