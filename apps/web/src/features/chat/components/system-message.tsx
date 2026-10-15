type SystemMessageProps = {
  /** Already built from the dictionary, e.g. "Ana entrou no chat". */
  text: string;
};

export function SystemMessage({ text }: SystemMessageProps) {
  return <p className="text-center text-sm text-fg-muted">{text}</p>;
}
