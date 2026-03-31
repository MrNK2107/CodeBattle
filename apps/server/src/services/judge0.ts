import axios from 'axios';

export interface Judge0Request {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
}

export interface Judge0Response {
  status: { id: number; description: string };
  stdout?: string;
  time?: string;
  memory?: number;
}

const baseUrl = process.env.JUDGE0_URL ?? 'http://localhost:2358';
const apiKey = process.env.JUDGE0_API_KEY;

export async function submitToJudge0(request: Judge0Request): Promise<Judge0Response> {
  const params = apiKey ? { base64_encoded: false, wait: true, fields: '*', 'X-RapidAPI-Key': apiKey } : { base64_encoded: false, wait: true };
  const { data } = await axios.post<Judge0Response>(`${baseUrl}/submissions/?base64_encoded=false&wait=true`, request, {
    headers: apiKey ? { 'X-Auth-Token': apiKey } : undefined,
    params
  });
  return data;
}
