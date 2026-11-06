import { useEffect, useRef } from "react";
export default function Dialog({ title, children, close }) {
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="small-dialog"
      onCancel={close}
      onClick={(event) => {
        if (event.target === ref.current) close();
      }}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
