import React from "react";
import { BrowserRouter } from "../router-compat";
import { RemoteApp } from "../RemoteApp";

export default function IndexPage() {
  return (
    <BrowserRouter>
      <RemoteApp basename="/" />
    </BrowserRouter>
  );
}
