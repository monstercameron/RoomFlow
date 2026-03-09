export type TextEmailPayload = {
  from: string;
  subject: string;
  text: string;
  to: string[];
};