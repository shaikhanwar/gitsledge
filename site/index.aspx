<%@ Page Language="C#" %>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SLED Use Case Library</title>
  <link rel="stylesheet" href="css/styles.css?v=7" />
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a href="#/home" class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-text">SLED Use Case Library<small>State &amp; Local Government &middot; Education</small></span>
      </a>
      <nav class="mainnav" id="mainnav">
        <a href="#/home" data-route="home">Home</a>
        <a href="#/usecases" data-route="usecases">Use Cases</a>
        <a href="#/industries" data-route="industries">Industries</a>
        <a href="#/solutionplays" data-route="solutionplays">Solution Plays</a>
        <a href="#/patterns" data-route="patterns">Patterns</a>
        <a href="#/events" data-route="events">Events</a>
        <a href="#/approvals" data-route="approvals" style="display:none">Approvals</a>
        <a href="#/audit" data-route="audit">Audit</a>
        <a href="#/about" data-route="about">About</a>
        <div class="nav-dropdown" id="registerMenu">
          <button class="nav-cta nav-dd-toggle" id="registerToggle" aria-haspopup="true" aria-expanded="false">+ Register &#9662;</button>
          <div class="nav-dd-panel" role="menu">
            <a href="#/register" role="menuitem" class="nav-dd-head">Register &amp; Capture hub</a>
            <a href="#/register/usecase" role="menuitem">Register a Use Case</a>
            <a href="#/register/solutionplay" role="menuitem">Register a Solution Play</a>
            <a href="#/register/pattern" role="menuitem">Reusable Pattern / Solution accelerator</a>
            <a href="#/register/industry" role="menuitem">Register an Industry</a>
            <a href="#/register/vertical" role="menuitem">Register a Vertical</a>
            <a href="#/register/event" role="menuitem">Add an Event</a>
          </div>
        </div>
      </nav>
    </div>
  </header>

  <main id="app" class="app">
    <div class="loading">Loading library…</div>
  </main>

  <footer class="footer">
    <span>SLED Use Case Library &mdash; internal Microsoft catalog of reusable SLED use cases. Prototype &middot; <a href="#/about" style="color:inherit;text-decoration:underline">About</a></span>
  </footer>

  <script type="module" src="js/app.js?v=14"></script>
</body>
</html>
