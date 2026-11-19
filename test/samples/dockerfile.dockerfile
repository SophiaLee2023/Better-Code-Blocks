# syntax=docker/dockerfile:1
ARG ROS_DISTRO=humble
FROM ros:${ROS_DISTRO}-ros-base AS builder
ENV DEBIAN_FRONTEND=noninteractive \
    WS=/ws
WORKDIR $WS
COPY --from=deps /src ./src
RUN apt-get update \
    # install deps
    && rosdep install --from-paths src --ignore-src -y \
    && rm -rf /var/lib/apt/lists/*
RUN . /opt/ros/${ROS_DISTRO}/setup.sh && colcon build --symlink-install
EXPOSE 8080/tcp
HEALTHCHECK --interval=30s CMD ros2 node list || exit 1
ENTRYPOINT ["/ros_entrypoint.sh"]
CMD ["ros2", "launch", "my_pkg", "bringup.launch.py"]
