import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist


class Driver(Node):
    """Publishes velocity commands."""

    def __init__(self, speed: float = 0.5):
        super().__init__('driver')
        self.pub = self.create_publisher(Twist, '/cmd_vel', 10)
        self.timer = self.create_timer(0.1, self.tick)
        self.speed = speed

    @property
    def is_fast(self) -> bool:
        return self.speed > 1.0  # m/s

    def tick(self):
        msg = Twist()
        msg.linear.x = self.speed
        self.pub.publish(msg)
        self.get_logger().info(f'speed={self.speed}')


def main(args=None):
    rclpy.init(args=args)
    rclpy.spin(Driver())
    rclpy.shutdown()


if __name__ == '__main__':
    main()
