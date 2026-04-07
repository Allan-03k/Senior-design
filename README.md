# SmartEats - AI Recipe &amp; Dining Recommendation System
Reference website：

https://www.supercook.com

https://jow.com/


To run the demo LOCALLY: 
1.cd to backend, run python app.py
-runs on http://localhost:5001

2.cd to client
-npm install
-npm run dev
-Open http://localhost:5173
Note: 
Ensure client/.env.local contains:
VITE_API_BASE=http://localhost:5001/api

To run the demo on VM (Hosted):
***Must be on UConn Network or VPN***
1. cd to backend, run python app.py
-runs on http://137.99.22.93:5001

2.cd to client
-npm install

(Optional but recommended)
-copy .env.vm .env.local

-npm run dev -- --host
-Open http://137.99.22.93:5173

Note:
If not copying the file, ensure client/.env.local contains:
VITE_API_BASE=http://137.99.22.93:5001/api


Already using Docker to run the project

docker-compose up --build
