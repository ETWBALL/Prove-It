#!/bin/bash

npm install

// Start development database

npx prisma dev &

sleep 3

// Start the application

npm run dev