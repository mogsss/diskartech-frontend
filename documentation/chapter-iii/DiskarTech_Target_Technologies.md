# Target Technologies

DiskarTech combines mobile development technologies, a PHP backend, relational records, and external services to support localized employment activities in the Municipality of Pinamalayan. React Native and Expo provide the mobile interfaces for Students, Employers, and Households, while Laravel provides the API and browser-based Admin interface. The documented database deployment uses MySQL on Aiven; Firebase Cloud Firestore supports messaging and notification records. The following discussion describes each technology's specific contribution to the system and its development process.

| Application area | Technologies used |
|---|---|
| Mobile application and navigation | React Native, React, Expo SDK 54, Expo Router, TypeScript and JavaScript |
| Mobile interface styling | NativeWind and Tailwind CSS |
| Backend and authentication | PHP 8.2, Laravel 12, Laravel Sanctum, HTTP/JSON APIs and Axios |
| Operational records and uploaded files | MySQL/SQL, documented Aiven hosting, Laravel Eloquent and Laravel public filesystem |
| Messaging and alerts | Firebase Cloud Firestore, Expo Notifications and Expo Push Service |
| AI-assisted processing | Google Gemini API, with OpenAI API as the configured job-matching backup |
| Google account selection and email verification | React Native Google Sign In, Gmail API and OAuth 2.0 |
| Location and maps | Expo Location, OpenStreetMap, Nominatim, Leaflet, MapLibre GL JS, OSRM and React Native WebView |
| Admin web interface | Laravel Blade, Tailwind CSS, Alpine.js and JavaScript |
| Build, dependency and deployment tools | Node.js, npm, Composer, Vite, Docker, Apache, Render and EAS Build |
| Development and testing | Git, GitHub, Visual Studio Code, OpenAI Codex, PHPUnit and Android testing tools |

## React Native

React Native is a framework for developing mobile applications using React and JavaScript, with interfaces rendered through native platform components. Its component-based structure supports reusable screens and shared application logic across mobile platforms, as described by [Meta Platforms, Inc (n.d.)](https://reactnative.dev/docs/getting-started).

In DiskarTech, React Native serves as the foundation of the mobile frontend. It implements registration, login, Student, Employer and Household profiles, job browsing, applications, messaging, verification, and employment-related screens. React supplies the component and state-management model used by these interfaces. The current implementation primarily targets Android users, while its shared codebase provides a foundation for future iOS testing and deployment.

## Expo SDK

Expo SDK is a collection of libraries and development tools for React Native applications. It provides interfaces for accessing supported device capabilities and integrates these features into the mobile development environment. ([Expo (n.d.-d)](https://docs.expo.dev/versions/v54.0.0/)).

DiskarTech uses Expo SDK 54 to support mobile development and device features such as location access, document selection, image selection, and notifications. Its modules help the researchers implement these capabilities within the React Native application.

## Expo Router

Expo Router is a navigation library that defines application routes through files and folders. Its routing structure supports navigation between screens in an Expo application. ([Expo (n.d.-e)](https://docs.expo.dev/router/introduction/)).

DiskarTech uses Expo Router to organize authentication screens and role-specific student, employer, and household interfaces. Route files define the application screens and their navigation structure, helping the researchers maintain consistent movement between related features.

## TypeScript

TypeScript extends JavaScript with a type system that helps identify incompatible data and coding errors during development. Type checking supports the organization and maintenance of application code. ([Microsoft (n.d.-a)](https://www.typescriptlang.org/docs/handbook/intro.html)).

DiskarTech uses TypeScript for most mobile screens, components, hooks, and service utilities. Type definitions describe users, job records, conversations, and application data exchanged with the backend, helping developers detect mismatches before running the application.

## JavaScript

JavaScript is a programming language used to implement application logic and interactive behavior. It supports functions, objects, events, and asynchronous operations in compatible runtime environments. ([MDN Web Docs (n.d.-a)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Introduction)).

DiskarTech uses JavaScript in project configuration and in the interactive web content embedded within selected mobile components. JavaScript code also supports browser interactions in the administrative interface and handles map controls and communication within embedded map pages.

## NativeWind

NativeWind provides a styling approach for React Native based on Tailwind-style utility classes. Developers apply these classes to compose the appearance of mobile interface components. ([NativeWind (n.d.)](https://www.nativewind.dev/docs)).

DiskarTech uses NativeWind to style mobile forms, cards, dashboards, buttons, and reusable components. Utility classes define spacing, typography, colors, and layouts, supporting a consistent presentation across the mobile screens.

## Tailwind CSS

Tailwind CSS is a CSS framework that supplies utility classes for styling web interfaces. These classes describe individual visual properties and can be composed directly in interface markup. ([Tailwind Labs (n.d.)](https://tailwindcss.com/docs/styling-with-utility-classes)).

DiskarTech uses Tailwind CSS to style the Laravel administrative website and landing page. It defines the appearance of dashboard panels, tables, forms, and navigation elements. Tailwind tooling also supports the styling configuration used by NativeWind in the mobile project.

## Axios

Axios is an HTTP client for JavaScript applications that supports asynchronous requests, response handling, and request interceptors. ([Axios (n.d.)](https://axios.rest/pages/getting-started/first-steps)).

DiskarTech uses Axios to connect the mobile frontend to the Laravel API hosted on Render. Its request interceptor attaches the stored authentication token to protected requests. Response handling allows mobile screens to display feedback when account, profile, job, or application operations succeed or fail.

## HTTP-based APIs

HTTP provides a request-and-response protocol for communication between clients and servers. Applications expose APIs through HTTP endpoints so that clients can retrieve data or submit changes. ([MDN Web Docs (n.d.-b)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)).

DiskarTech uses HTTP-based API endpoints to exchange data between the mobile application and Laravel backend. Requests support registration, login, job retrieval, profile updates, applications, and email verification. The deployed API uses HTTPS, and its structured request and response data commonly uses JSON.

## AsyncStorage

AsyncStorage provides persistent, asynchronous key-value storage for React Native applications. The Expo documentation identifies it as an unencrypted storage mechanism for locally retained application data ([Expo (n.d.-a)](https://docs.expo.dev/versions/v54.0.0/sdk/async-storage/)).

DiskarTech uses AsyncStorage to retain session-related data, user information, selected preferences, and other values needed between application launches. These stored values help the frontend restore the user interface and attach authentication credentials to API requests. Its role is local application storage; the authoritative account and employment records remain in the backend database.

## PHP

PHP is a programming language widely used for web application development and server-side processing. Its official documentation describes support for handling application logic and interacting with databases and other services ([The PHP Group (n.d.)](https://www.php.net/manual/en/introduction.php)).

DiskarTech uses PHP as the backend programming language. The deployed container runs PHP 8.2 with Apache and the PHP extensions needed by Laravel. PHP executes server-side validation, authentication, database operations, file handling, and communication with external AI and email services.

## Laravel

Laravel is a PHP application framework with features for routing, controllers, middleware, validation, database access, and background processing. These capabilities support the development and organization of web applications and APIs ([Laravel (n.d.-c)](https://laravel.com/framework/docs/12.x)).

DiskarTech uses Laravel 12 as its primary backend framework. It manages student, employer, household, and administrator records; job postings; job applications; verification workflows; incident reports; and employment-related records. Laravel controllers expose the API used by the mobile application, while Eloquent models and migrations organize relational data and database changes.

## Laravel Sanctum

Laravel Sanctum supports authentication for mobile applications and APIs through personal access tokens. Applications can submit these tokens with subsequent requests to access protected endpoints ([Laravel (n.d.-d)](https://laravel.com/framework/docs/12.x/sanctum)).

DiskarTech uses Sanctum to issue authentication tokens following mobile registration or login. Protected API routes require an authenticated user before processing account-specific operations. Laravel password hashing and request validation support the authentication workflow, while administrator access uses a separate session-based authentication guard.

## MySQL

MySQL is a relational database management system that organizes records into tables. Identifiers and relationships connect data stored across these tables. ([Oracle (n.d.-b)](https://dev.mysql.com/doc/refman/8.4/en/what-is-mysql.html)).

DiskarTech uses MySQL to store its principal operational records, including users, student profiles, employer and household profiles, job postings, applications, saved jobs, reviews, and reports. Laravel models and database queries provide access to these records for mobile and administrative workflows.

## Structured Query Language (SQL)

SQL is a language used to query and manage data in relational databases. MySQL supports statements for retrieving records and modifying database contents. ([Oracle (n.d.-a)](https://dev.mysql.com/doc/refman/8.4/en/sql-statements.html)).

DiskarTech uses SQL through Laravel's Eloquent models and query builder to retrieve, filter, insert, update and delete operational records. SQL expressions also support approximate distance calculations when retrieving nearby job opportunities. Database queries connect account, job and application records throughout the mobile and administrative workflows.

## Aiven for MySQL

Aiven for MySQL provides a managed MySQL database service that can be accessed by applications through configured database connections ([Aiven (n.d.)](https://aiven.io/docs/products/mysql)). Managed database hosting enables application servers to connect to a database deployed separately from the application itself.

The project's existing deployment documentation identifies Aiven as the MySQL hosting service for DiskarTech. Laravel provides the MySQL connection and SSL configuration used to connect to an external database. The actual connection is selected through deployment environment settings, allowing relational records to be hosted separately from the application server.

## Firebase Cloud Firestore

Cloud Firestore is a document-oriented database that supports data synchronization through listeners that receive updates when stored data changes ([Google (n.d.-a)](https://firebase.google.com/docs/firestore)). This capability is useful for application features that require ongoing communication and timely interface updates.

DiskarTech uses Firebase Cloud Firestore for conversations, chat messages, application notification records, and related notification-support data. Firestore listeners update messaging and notification interfaces when relevant records change. The Laravel administrative messaging interface also connects to Firestore. Account authentication and the main employment records are handled by Laravel and MySQL.

## Google Gemini API

The Gemini API provides access to Google AI models that can process language and other supported inputs to generate responses for application features. Its documentation describes capabilities including text generation and analysis of multimodal inputs ([Google (n.d.-c)](https://ai.google.dev/gemini-api/docs)).

DiskarTech integrates Gemini through backend HTTP requests for student-facing job recommendations, the DARA support assistant, and preliminary analysis of uploaded verification documents. Job matching evaluates the student's skills, available days and time slot against the available jobs. Geographic distance is calculated separately by backend queries. Document-analysis results supply advisory remarks for manual Admin review; account approval remains an administrator action.

## OpenAI API

The OpenAI API provides programmatic access to AI models, including GPT-4o mini, for tasks involving text interpretation and generation ([OpenAI (n.d.-b)](https://developers.openai.com/api/docs/models/gpt-4o-mini)). Applications can use model responses as part of a controlled processing workflow.

DiskarTech includes an OpenAI API integration as a secondary provider for job matching when the Gemini request is unsuccessful. The configured backup uses GPT-4o mini to evaluate submitted job and student information. Its availability depends on valid credentials and provider quota. If both AI providers are unavailable, the backend uses its implemented schedule-based fallback so that job results can still be returned.

## Gmail API

The Gmail API allows authorized applications to send email messages through a Gmail account using programmatic requests. ([Google (n.d.-b)](https://developers.google.com/workspace/gmail/api/guides/sending)).

DiskarTech uses the Gmail API to send six-digit email verification codes from its official Gmail account through HTTPS requests. Verification codes expire after ten minutes, and successful sends enforce a sixty-second resend cooldown. The backend reports a sending failure when Gmail does not accept the email request.

## OAuth 2.0

OAuth 2.0 is an authorization framework that allows applications to access permitted account resources through tokens. Access tokens authorize requests, while refresh tokens can obtain replacement access tokens. ([Google (n.d.-e)](https://developers.google.com/identity/protocols/oauth2/web-server)).

DiskarTech uses OAuth 2.0 to authorize its backend to send verification emails through the official Gmail account. The backend obtains access tokens using its configured refresh token and keeps the client credentials and refresh token in environment configuration. Token validity depends on the Google authorization settings and account permissions.

## Expo Location

Expo Location provides functions for requesting location permission, obtaining device coordinates, and performing supported geocoding operations in Expo applications. ([Expo (n.d.-f)](https://docs.expo.dev/versions/v54.0.0/sdk/location/)).

DiskarTech uses Expo Location to access device coordinates with user permission and assist users in selecting profile or job locations. Its geocoding functions support conversion between coordinates and address information. Location data is then available to the backend for nearby job retrieval.

## OpenStreetMap

OpenStreetMap is a collaborative project that provides geographic information maintained by contributors. Its map data represents features such as roads, places, and geographic boundaries. ([OpenStreetMap Foundation (n.d.)](https://www.openstreetmap.org/about)).

DiskarTech uses OpenStreetMap tiles in its embedded location-selection and map-viewing interfaces. These tiles provide the geographic background for location markers and help users review where profiles and employment opportunities are situated.

## Nominatim

Nominatim is a geocoding service associated with OpenStreetMap data. Its reverse-geocoding endpoint accepts coordinates and returns corresponding address information. ([Nominatim (n.d.)](https://nominatim.org/release-docs/latest/api/Reverse/)).

DiskarTech uses Nominatim for address searches and as a fallback for reverse geocoding in the location-selection interface. Typed searches request matching places within the Philippines. If native reverse geocoding does not provide a usable address, the application requests address information for the selected coordinates. These results help users review a profile or job location before saving it.

## Leaflet

Leaflet is a JavaScript library for interactive web maps. It supports map tiles, markers, and controls that allow users to explore geographic information. ([Leaflet (n.d.)](https://leafletjs.com/)).

DiskarTech uses Leaflet in its location-selection modal. The map displays OpenStreetMap tiles and a marker that helps users select and review coordinates before saving a location with profile or job information.

## MapLibre GL JS

MapLibre GL JS is a JavaScript library for rendering interactive maps in web interfaces. It supports map layers, geographic markers, and navigation controls. ([MapLibre (n.d.)](https://maplibre.org/maplibre-gl-js/docs/)).

DiskarTech uses MapLibre GL JS in its map-viewing modal. The embedded map presents OpenStreetMap tiles and location markers so that users can review the geographic context of employment opportunities and selected locations.

## React Native WebView

React Native WebView is a component that embeds web content within a React Native application. It allows a mobile interface to display pages containing HTML and JavaScript. ([Expo (n.d.-h)](https://docs.expo.dev/versions/v54.0.0/sdk/webview/)).

DiskarTech uses WebView to display its Leaflet and MapLibre map pages within mobile modals. Communication between embedded web content and the React Native interface allows the application to receive selected coordinates and update location-related information.

## Expo Notifications

Expo Notifications provides functions for requesting notification permission, obtaining push tokens, handling received notifications, and scheduling local notifications. ([Expo (n.d.-g)](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/)).

DiskarTech uses Expo Notifications to manage notification permissions and display local alerts associated with messages and Smart Alerts. Its notification handlers connect notification events with the mobile interface. Device permissions and the application environment affect how notifications are presented.

## Expo Push Service

The Expo Push Service accepts notification requests addressed to Expo push tokens and passes them to the appropriate platform notification infrastructure. ([Expo (n.d.-c)](https://docs.expo.dev/push-notifications/overview/)).

DiskarTech uses the Expo Push Service to submit remote notification requests for supported messaging and alert workflows. Stored push tokens identify the intended devices. Firestore supplies notification-related records and listeners, while the push service handles delivery requests to the platform notification services.

## Laravel Blade

Blade is the template engine included with Laravel. It combines HTML markup with template directives to generate server-rendered web pages. ([Laravel (n.d.-a)](https://laravel.com/framework/docs/12.x/blade)).

DiskarTech uses Blade templates for its administrative dashboard, user management, verification review, job moderation, report management, and messaging pages. These templates display backend records and administrative controls through a browser-based interface.

## Alpine.js

Alpine.js is a JavaScript framework that adds interactive behavior through attributes attached to HTML elements. It supports interface state and event handling within web pages. ([Alpine.js (n.d.)](https://alpinejs.dev/)).

DiskarTech uses Alpine.js to support interactive elements in its Laravel administrative interface. It enables browser interactions within rendered pages and complements Blade templates and Tailwind CSS in the administration workflow.

## Laravel Filesystem

Laravel's filesystem interface provides functions for storing and retrieving files through configured storage disks ([Laravel (n.d.-b)](https://laravel.com/framework/docs/12.x/filesystem)). File paths can be associated with database records to connect uploaded content with the accounts or processes that use it.

DiskarTech uses Laravel's public storage disk for uploaded profile images, resumes, identification images, enrollment documents, and employer verification files. Database records retain the corresponding file paths, and the backend exposes file-serving routes for application access. These uploads use the Laravel application filesystem in the current implementation; the project does not implement Firebase Cloud Storage for this purpose.

## Docker

Docker provides tools for packaging applications and their dependencies into images and running them in containers. A container defines the runtime environment used by an application. ([Docker (n.d.)](https://docs.docker.com/get-started/docker-overview/)).

DiskarTech uses Docker to package the Laravel backend with PHP 8.2, Apache, required PHP extensions, and installed dependencies. Its image and startup configuration define the environment used by the deployed backend, including configuration preparation and queue-worker startup.

## Apache HTTP Server

Apache HTTP Server is a web server that processes HTTP requests according to its configuration. It can serve application resources and support server-side processing through configured modules. ([Apache Software Foundation (n.d.)](https://httpd.apache.org/docs/2.4/)).

DiskarTech uses Apache in the PHP 8.2 container to serve its Laravel application. Requests reaching the deployed backend are handled through the configured web server and Laravel entry point, allowing the mobile API and administrative website to respond to client requests.

## Render

Render is a hosting platform that supports deployment of web services from Docker images. Its service configuration provides deployment and runtime settings for hosted applications. ([Render (n.d.)](https://render.com/docs/docker)).

DiskarTech's mobile API client is configured to communicate with a Laravel backend at a Render HTTPS address. The backend includes a Dockerfile and startup script for its PHP/Apache service, queue worker and environment-based configuration. These project files establish the intended deployment arrangement; current service health and hosting-dashboard settings are separate operational concerns.

## Node.js

Node.js is a JavaScript runtime that executes JavaScript outside a web browser. It supports command-line tools and other applications built with JavaScript. ([Node.js (n.d.)](https://nodejs.org/learn/getting-started/introduction-to-nodejs)).

DiskarTech uses Node.js to run Expo development tools and supporting JavaScript build tools. It provides the runtime needed for mobile development commands and web-asset build activities. PHP and Laravel provide the deployed backend application runtime.

## npm

npm provides a package registry and command-line tools for managing JavaScript dependencies. Its commands install packages and execute scripts defined by application projects. ([npm (n.d.)](https://docs.npmjs.com/about-npm/)).

DiskarTech uses npm to install and maintain the mobile project dependencies and supporting web development packages. Package scripts start the Expo development server and run configured development or build commands. Package manifests and lockfiles record dependency requirements.

## Composer

Composer is a dependency management tool for PHP. It installs the packages declared by a project and resolves their dependency requirements. ([Composer (n.d.)](https://getcomposer.org/doc/00-intro.md)).

DiskarTech uses Composer to install Laravel, Laravel Sanctum, and PHP development and testing packages. Dependency installation is also part of the backend container build, ensuring the deployed application includes the PHP libraries declared by the project.

## Expo Application Services Build

EAS Build is Expo's hosted service for producing application binaries for Android and iOS. Build profiles allow projects to define different development, internal testing, and production configurations ([Expo (n.d.-b)](https://docs.expo.dev/build/introduction/)).

DiskarTech contains EAS build profiles for development, preview, and production. The development and preview Android profiles specify APK output for installation and testing. These configurations support distribution of Android test builds and preparation of production binaries. The current project configuration does not establish that an iOS build has already been produced or tested.

## Git

Git is a version control system that records changes to project files over time. Its history allows developers to review revisions and compare versions of source code. ([Git (n.d.)](https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control)).

DiskarTech uses Git to track frontend and backend source changes through commits. Version history provides a record of implementation work, fixes, and updates that the researchers can review when maintaining or troubleshooting the application.

## GitHub

GitHub is a platform for hosting Git repositories and supporting collaboration around source code. It provides repository access and tools for reviewing project changes. ([GitHub (n.d.)](https://docs.github.com/en/get-started/start-your-journey/what-is-github)).

DiskarTech uses GitHub to host its frontend and backend repositories and support collaboration on development work. Both local projects define GitHub remotes, providing repository locations for sharing source changes and maintaining revision history.

## Visual Studio Code

Visual Studio Code provides a source-code editor with an integrated terminal, debugging features, language support, and extensions for development tasks ([Microsoft (n.d.-b)](https://code.visualstudio.com/docs)). These features support work across different programming languages and project tools.

The researchers use Visual Studio Code to develop and maintain the DiskarTech mobile frontend and Laravel backend. The editor supports source inspection, terminal-based development commands, version control, and log review across the TypeScript, JavaScript and PHP portions of the project.

## OpenAI Codex

OpenAI identifies Codex as an AI coding agent for software development. Its coding capabilities support tasks related to implementing, reviewing, and troubleshooting source code ([OpenAI (n.d.-a)](https://developers.openai.com/api/docs/guides/code-generation)).

Codex is used as a development assistance tool for DiskarTech, helping the researchers inspect project files, implement changes, identify defects, prepare tests, and verify backend and frontend behavior. Its role supports the development process, while the application's runtime AI features use the Gemini and OpenAI API integrations. The researchers remain responsible for reviewing generated changes and validating system behavior.

## Android Emulator

The Android Emulator simulates Android devices on a development computer. Developers can use it to run applications under selected device configurations. ([Google (n.d.-d)](https://developer.android.com/studio/run/emulator)).

For DiskarTech, the Android Emulator is a target testing tool for reviewing mobile screen behavior, navigation and selected Android device configurations. Emulator testing can complement tests on physical Android devices. Compatibility and performance claims should reflect recorded test results for the actual devices or emulator configurations evaluated.

## PHPUnit

PHPUnit is a testing framework for PHP applications. It provides assertions and test organization for checking application behavior through automated tests. ([PHPUnit (n.d.)](https://docs.phpunit.de/en/11.5/)).

DiskarTech uses PHPUnit to run backend tests for OTP verification, resend cooldowns, email-provider failures, and job-matching fallback behavior. These automated checks help the researchers identify regressions in defined scenarios and complement manual application and email-delivery testing.

## React Native Google Sign In

React Native Google Sign In supplies native Google account sign-in interfaces for React Native applications. Its documentation describes account selection, returned profile data and native configuration requirements ([React Native Google Sign In (n.d.)](https://react-native-google-signin.github.io/docs/original)).

DiskarTech uses `@react-native-google-signin/google-signin` to open the native account-selection interface and obtain the selected user's email and profile details. The mobile application submits the email to its Laravel Google-login endpoint, which looks up the DiskarTech account and issues a Sanctum token. Registration screens can also use the selected profile to prefill account information. This implementation uses the application's Laravel account system; Firebase Authentication is not involved in this flow.

## Open Source Routing Machine (OSRM)

OSRM provides routing services over HTTP. Its Route service can return route geometry, distance, duration and maneuver information for supplied coordinates ([Project OSRM (n.d.)](https://project-osrm.org/docs/v5.24.0/api/)).

DiskarTech's map-viewing modal requests routes between the user's coordinates and the selected destination from the configured OSRM endpoint. When the service returns a route, the application draws its geometry on the MapLibre map and displays distance, estimated duration and navigation steps. Route availability depends on the endpoint and its supported routing profile.

## Vite

Vite provides a development server and build tooling for web application assets. It supports development-time asset loading and production builds through project configuration ([Vite (n.d.)](https://vite.dev/guide/)).

DiskarTech configures Vite in its Laravel project with the Laravel Vite plugin and Tailwind CSS plugin. The configuration identifies the web CSS and JavaScript entry files, while npm scripts expose development and build commands. Vite forms part of the web-asset toolchain used alongside the PHP backend.

## References

Aiven. (n.d.). *Aiven for MySQL*. Retrieved October 8, 2026, from [https://aiven.io/docs/products/mysql](https://aiven.io/docs/products/mysql)

Alpine.js. (n.d.). *Alpine.js*. Retrieved October 8, 2026, from [https://alpinejs.dev/](https://alpinejs.dev/)

Apache Software Foundation. (n.d.). *Apache HTTP Server version 2.4 documentation*. Retrieved October 8, 2026, from [https://httpd.apache.org/docs/2.4/](https://httpd.apache.org/docs/2.4/)

Axios. (n.d.). *First steps*. Retrieved October 8, 2026, from [https://axios.rest/pages/getting-started/first-steps](https://axios.rest/pages/getting-started/first-steps)

Composer. (n.d.). *Introduction*. Retrieved October 8, 2026, from [https://getcomposer.org/doc/00-intro.md](https://getcomposer.org/doc/00-intro.md)

Docker. (n.d.). *What is Docker?*. Retrieved October 8, 2026, from [https://docs.docker.com/get-started/docker-overview/](https://docs.docker.com/get-started/docker-overview/)

Expo. (n.d.-a). *AsyncStorage*. Retrieved October 8, 2026, from [https://docs.expo.dev/versions/v54.0.0/sdk/async-storage/](https://docs.expo.dev/versions/v54.0.0/sdk/async-storage/)

Expo. (n.d.-b). *EAS Build*. Retrieved October 8, 2026, from [https://docs.expo.dev/build/introduction/](https://docs.expo.dev/build/introduction/)

Expo. (n.d.-c). *Expo push notifications: Overview*. Retrieved October 8, 2026, from [https://docs.expo.dev/push-notifications/overview/](https://docs.expo.dev/push-notifications/overview/)

Expo. (n.d.-d). *Expo SDK 54 reference*. Retrieved October 8, 2026, from [https://docs.expo.dev/versions/v54.0.0/](https://docs.expo.dev/versions/v54.0.0/)

Expo. (n.d.-e). *Introduction to Expo Router*. Retrieved October 8, 2026, from [https://docs.expo.dev/router/introduction/](https://docs.expo.dev/router/introduction/)

Expo. (n.d.-f). *Location*. Retrieved October 8, 2026, from [https://docs.expo.dev/versions/v54.0.0/sdk/location/](https://docs.expo.dev/versions/v54.0.0/sdk/location/)

Expo. (n.d.-g). *Notifications*. Retrieved October 8, 2026, from [https://docs.expo.dev/versions/v54.0.0/sdk/notifications/](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/)

Expo. (n.d.-h). *React Native WebView*. Retrieved October 8, 2026, from [https://docs.expo.dev/versions/v54.0.0/sdk/webview/](https://docs.expo.dev/versions/v54.0.0/sdk/webview/)

Git. (n.d.). *About version control*. Retrieved October 8, 2026, from [https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control](https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control)

GitHub. (n.d.). *What is GitHub?*. Retrieved October 8, 2026, from [https://docs.github.com/en/get-started/start-your-journey/what-is-github](https://docs.github.com/en/get-started/start-your-journey/what-is-github)

Google. (n.d.-a). *Cloud Firestore*. Retrieved October 8, 2026, from [https://firebase.google.com/docs/firestore](https://firebase.google.com/docs/firestore)

Google. (n.d.-b). *Create and send email messages*. Retrieved October 8, 2026, from [https://developers.google.com/workspace/gmail/api/guides/sending](https://developers.google.com/workspace/gmail/api/guides/sending)

Google. (n.d.-c). *Gemini API documentation*. Retrieved October 8, 2026, from [https://ai.google.dev/gemini-api/docs](https://ai.google.dev/gemini-api/docs)

Google. (n.d.-d). *Run apps on the Android Emulator*. Retrieved October 8, 2026, from [https://developer.android.com/studio/run/emulator](https://developer.android.com/studio/run/emulator)

Google. (n.d.-e). *Using OAuth 2.0 for web server applications*. Retrieved October 8, 2026, from [https://developers.google.com/identity/protocols/oauth2/web-server](https://developers.google.com/identity/protocols/oauth2/web-server)

Laravel. (n.d.-a). *Blade templates*. Retrieved October 8, 2026, from [https://laravel.com/framework/docs/12.x/blade](https://laravel.com/framework/docs/12.x/blade)

Laravel. (n.d.-b). *File storage*. Retrieved October 8, 2026, from [https://laravel.com/framework/docs/12.x/filesystem](https://laravel.com/framework/docs/12.x/filesystem)

Laravel. (n.d.-c). *Laravel 12.x installation*. Retrieved October 8, 2026, from [https://laravel.com/framework/docs/12.x](https://laravel.com/framework/docs/12.x)

Laravel. (n.d.-d). *Laravel Sanctum*. Retrieved October 8, 2026, from [https://laravel.com/framework/docs/12.x/sanctum](https://laravel.com/framework/docs/12.x/sanctum)

Leaflet. (n.d.). *Leaflet: A JavaScript library for interactive maps*. Retrieved October 8, 2026, from [https://leafletjs.com/](https://leafletjs.com/)

MapLibre. (n.d.). *Introduction to MapLibre GL JS*. Retrieved October 8, 2026, from [https://maplibre.org/maplibre-gl-js/docs/](https://maplibre.org/maplibre-gl-js/docs/)

MDN Web Docs. (n.d.-a). *Introduction to JavaScript*. Retrieved October 8, 2026, from [https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Introduction](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Introduction)

MDN Web Docs. (n.d.-b). *Overview of HTTP*. Retrieved October 8, 2026, from [https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)

Meta Platforms, Inc. (n.d.). *Introduction to React Native*. Retrieved October 8, 2026, from [https://reactnative.dev/docs/getting-started](https://reactnative.dev/docs/getting-started)

Microsoft. (n.d.-a). *The TypeScript handbook*. Retrieved October 8, 2026, from [https://www.typescriptlang.org/docs/handbook/intro.html](https://www.typescriptlang.org/docs/handbook/intro.html)

Microsoft. (n.d.-b). *Visual Studio Code documentation*. Retrieved October 8, 2026, from [https://code.visualstudio.com/docs](https://code.visualstudio.com/docs)

NativeWind. (n.d.). *Overview*. Retrieved October 8, 2026, from [https://www.nativewind.dev/docs](https://www.nativewind.dev/docs)

Node.js. (n.d.). *Introduction to Node.js*. Retrieved October 8, 2026, from [https://nodejs.org/learn/getting-started/introduction-to-nodejs](https://nodejs.org/learn/getting-started/introduction-to-nodejs)

Nominatim. (n.d.). *Reverse geocoding*. Retrieved October 8, 2026, from [https://nominatim.org/release-docs/latest/api/Reverse/](https://nominatim.org/release-docs/latest/api/Reverse/)

npm. (n.d.). *About npm*. Retrieved October 8, 2026, from [https://docs.npmjs.com/about-npm/](https://docs.npmjs.com/about-npm/)

OpenAI. (n.d.-a). *Code generation*. Retrieved October 8, 2026, from [https://developers.openai.com/api/docs/guides/code-generation](https://developers.openai.com/api/docs/guides/code-generation)

OpenAI. (n.d.-b). *GPT-4o mini*. Retrieved October 8, 2026, from [https://developers.openai.com/api/docs/models/gpt-4o-mini](https://developers.openai.com/api/docs/models/gpt-4o-mini)

OpenStreetMap Foundation. (n.d.). *About OpenStreetMap*. Retrieved October 8, 2026, from [https://www.openstreetmap.org/about](https://www.openstreetmap.org/about)

Oracle. (n.d.-a). *SQL statements*. Retrieved October 8, 2026, from [https://dev.mysql.com/doc/refman/8.4/en/sql-statements.html](https://dev.mysql.com/doc/refman/8.4/en/sql-statements.html)

Oracle. (n.d.-b). *What is MySQL?*. Retrieved October 8, 2026, from [https://dev.mysql.com/doc/refman/8.4/en/what-is-mysql.html](https://dev.mysql.com/doc/refman/8.4/en/what-is-mysql.html)

PHPUnit. (n.d.). *PHPUnit 11.5 manual*. Retrieved October 8, 2026, from [https://docs.phpunit.de/en/11.5/](https://docs.phpunit.de/en/11.5/)

Project OSRM. (n.d.). *OSRM API documentation*. Retrieved October 9, 2026, from [https://project-osrm.org/docs/v5.24.0/api/](https://project-osrm.org/docs/v5.24.0/api/)

React Native Google Sign In. (n.d.). *Original Google sign in*. Retrieved October 9, 2026, from [https://react-native-google-signin.github.io/docs/original](https://react-native-google-signin.github.io/docs/original)

Render. (n.d.). *Docker on Render*. Retrieved October 8, 2026, from [https://render.com/docs/docker](https://render.com/docs/docker)

Tailwind Labs. (n.d.). *Styling with utility classes*. Retrieved October 8, 2026, from [https://tailwindcss.com/docs/styling-with-utility-classes](https://tailwindcss.com/docs/styling-with-utility-classes)

The PHP Group. (n.d.). *Introduction*. Retrieved October 8, 2026, from [https://www.php.net/manual/en/introduction.php](https://www.php.net/manual/en/introduction.php)

Vite. (n.d.). *Getting started*. Retrieved October 9, 2026, from [https://vite.dev/guide/](https://vite.dev/guide/)

## Implementation alignment notes for the researchers

These notes explain corrections to the supplied draft and the evidence used to describe the stack. They can remain outside the final thesis narrative.

| Draft statement | Source-aligned treatment |
|---|---|
| Node.js processes the main backend requests | PHP/Laravel implements the API. Node.js runs Expo and JavaScript build tools. |
| Firebase handles all accounts, jobs and uploaded files | Laravel/Sanctum handles application authentication; relational models handle employment records; Laravel public storage handles uploads. Firestore supports chat, notification records and push-token data. |
| Claude powers workforce recommendations | No Anthropic/Claude runtime integration was found in the inspected application source. The implemented providers are Gemini and the optional OpenAI API backup. Claude can be listed separately as a development tool only if its actual use is established. |
| Codex is the application's backup AI provider | The backup calls the OpenAI Chat Completions API with `gpt-4o-mini`. Codex is used for development assistance. |
| Gemini ranks applicants for employers using location | The implemented matching endpoint recommends jobs to a Student using skills and schedule information. Backend distance calculations and nearby-job queries provide the location functionality. |
| Firebase Cloud Storage stores resumes and verification documents | The inspected upload handlers store these files on Laravel's public disk. No Firebase Cloud Storage upload implementation was found. |
| PayMongo sandbox is an implemented technology | No payment-gateway implementation was found in the inspected application source. Payment integration remains outside the implemented technology list. |
| Generic SDK and Mobile Application entries | Named SDKs and libraries are documented individually. The mobile application is the resulting product, rather than an additional development technology. |
| Google account selection establishes complete backend Google-token verification | The current Laravel handler validates and looks up the submitted email; it does not validate a Google ID token. The technology description therefore makes no claim of server-side Google-token verification. |
| Aiven hosting and emulator testing are independently proven by source code | Aiven is retained as the hosting provider identified in the existing project documentation. Live database settings and completed emulator test runs were not independently verified in this revision. |

| Evidence area | Project files checked |
|---|---|
| Mobile frameworks, SDKs and dependencies | `DISKARTECH/package.json`, `DISKARTECH/eas.json` |
| Backend, authentication and web build tools | `diskartech-backend/composer.json`, `diskartech-backend/package.json`, `diskartech-backend/vite.config.js`, `diskartech-backend/app/Http/Controllers/Api/AuthController.php` |
| Database and file storage | `diskartech-backend/config/database.php`, `diskartech-backend/config/filesystems.php`, registration upload handlers and Eloquent models |
| AI integrations | `diskartech-backend/app/Http/Controllers/Api/JobMatchingController.php`, `SupportAiController.php`, `diskartech-backend/app/Jobs/AnalyzeVerificationDocument.php` |
| Google and email integration | `DISKARTECH/utils/googleAuth.ts`, `diskartech-backend/app/Services/GmailOtpMailer.php` |
| Messaging and notifications | `DISKARTECH/utils/firebase.ts`, `DISKARTECH/utils/chat.ts`, `DISKARTECH/utils/notifications.ts` |
| Maps, geocoding and routes | `DISKARTECH/components/ui/modals/LocationPickerModal.tsx`, `DISKARTECH/components/ui/modals/MapViewerModal.tsx` |
| Admin web interface | `diskartech-backend/resources/views/components/admin-layout.blade.php`, Admin Blade templates |
| Deployment and repositories | `diskartech-backend/Dockerfile`, `diskartech-backend/docker-entrypoint.sh`, `DISKARTECH/api/axios.ts`, frontend/backend Git remotes |
| Automated backend checks | `diskartech-backend/tests/Feature/EmailOtpTest.php`, `JobMatchingTest.php`, `JobMatchingProviderTest.php` |

Provider documentation supports the general descriptions of the technologies. Project files establish their implemented roles. Package versions describe the repository's declared dependencies, not claims about the latest available versions. References use “n.d.” where a publication date has not been established, rather than assigning an unsupported year.
