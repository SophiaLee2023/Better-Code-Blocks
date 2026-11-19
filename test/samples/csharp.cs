using System;
using System.Threading.Tasks;

namespace Demo
{
    public record Point(int X, int Y);

    public class Program
    {
        public static async Task Main(string[] args)
        {
            var p = new Point(1, 2);
            string path = @"C:\temp\out.txt";
            Console.WriteLine($"Point: {p.X}, {p.Y} -> {path}");
            await Task.Delay(100);
        }
    }
}
