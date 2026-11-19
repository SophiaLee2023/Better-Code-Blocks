#!/usr/bin/env bash
# Build and run a ROS 2 workspace inside Docker
set -euo pipefail
export ROS_DISTRO=humble
WS="$HOME/ros2_ws"

source /opt/ros/$ROS_DISTRO/setup.bash
sudo apt install -y ros-humble-turtlesim python3-colcon-common-extensions
rosdep install --from-paths src --ignore-src -y
colcon build --symlink-install --packages-select my_pkg
source install/setup.bash

ros2 run turtlesim turtlesim_node --ros-args -r __node:=turtle1
ros2 topic echo /cmd_vel geometry_msgs/msg/Twist
ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 2.0}}"
ros2 launch my_pkg bringup.launch.py use_sim:=true
ros2 param get /turtlesim background_r | grep -i value

docker build -t my-ros:humble -f Dockerfile .
docker run --rm -it --net=host -v "$WS:/ws" my-ros:humble bash
docker compose up -d && docker compose logs -f robot
docker exec -it $(docker ps -q | head -n 1) ros2 node list

for f in *.launch.py; do
  echo "found ${f}" >> log.txt 2>&1
done
cat <<EOF > config.yaml
key: value
EOF
