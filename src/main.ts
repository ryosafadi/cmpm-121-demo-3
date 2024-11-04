import "./style.css";

const map = document.querySelector<HTMLDivElement>("#map")!;

const starterButton = document.createElement("button");
starterButton.innerHTML = "test";
map.append(starterButton);

starterButton.addEventListener("click", () => {
  alert("button clicked!");
});
