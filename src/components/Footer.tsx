import Logo from "./Logo";
import type { Copy } from "../data/copy";

export default function Footer({ copy }: { copy: Copy }) {
  return (
    <footer className="footer">
      <a className="brand" href="#top">
        <Logo size={36} />
        <span>DINAMO</span>
      </a>
      <p>{copy.rights}</p>
      <a href="#top">{copy.backTop}</a>
    </footer>
  );
}
