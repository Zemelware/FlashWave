// sidebar-loader.js
// Loads the sidebar HTML into the .sidebar div on each page

fetch("sidebar.html")
  .then((response) => response.text())
  .then((html) => {
    document.querySelector(".sidebar").innerHTML = html;
    // Optionally, set the active link based on the current page
    const links = document.querySelectorAll(".sidebar a");
    links.forEach((link) => {
      const currentPage = window.location.pathname.split("/").pop();
      if (link.getAttribute("href") === currentPage) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  });
