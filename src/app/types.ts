export interface Option {
  option_id: string;
  option_text: string;
  content: string;
  isCorrect: boolean;
}

export interface Question {
  question_id: string;
  question_text: string;
  content: string;
  format: "mcq" | "code" | "descriptive";
  answer_text: string | null;
  options: Option[];
}

export interface TestData {
  test_id: string;
  title: string;
  points: number;
  test_type: string;
  order: number | null;
  questions: Question[];
}

export interface StudentRemote {
  student_remote_id: string;
  student_remote_name: string;
  student_remote_mac_id?: string;
}

export interface RemoteResponse {
  student_remote_id: string;
  student_remote_response: string;
  timestamp: number;
}

export interface QuestionResponse {
  question_id: string;
  responses: RemoteResponse[];
}

export interface RootState {
  remote: {
    receivers: {
      receiverID: string;
      receiverName: string;
      remotes: { remote_id: string; remote_name: string }[];
    }[];
    currentReceiver: string;
  };
}

export interface Receiver {
  receiverName: string;
  receiverID: string;
  remotes: Remote[];
}

export interface Remote {
  remote_name: string;
  remote_id: string;
}

export interface User {
  id?: string;
  name?: string;
  email?: string;
}