#!/bin/bash

# Calculate the total available memory in bytes
total_memory_bytes=$(grep MemTotal /proc/meminfo | awk '{print $2 * 1024}')

# Convert the total available memory to gigabytes (GB) and use a percentage of it for the JVM
percentage=0.8 # Change this value according to your needs
memory_to_use_bytes=$(printf "%.0f" "$(echo "$total_memory_bytes $percentage" | awk '{ printf("%.3f", $1 * $2) }')")

# Convert the memory to use to the closest integer gigabytes
memory_to_use_gb=$((memory_to_use_bytes / (1024 * 1024 * 1024)))

# Append the vmargs setting to the config.properties file
echo -e "\nvmargs=-Xmx${memory_to_use_gb}g" >> config.properties
