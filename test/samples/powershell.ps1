# Start the dev container and run a ROS 2 node from Windows
param([string]$Distro = "humble", [int]$Retries = 3)

$env:ROS_DOMAIN_ID = 42
$image = "my-ros:$Distro"
<# block
   comment #>
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed"
    exit 1
}
docker compose up -d
docker run --rm -it $image ros2 topic list
foreach ($i in 1..$Retries) {
    $result = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing
    if ($result.StatusCode -eq 200) { break }
    Start-Sleep -Seconds 2
}
$files = Get-ChildItem -Path .\src -Filter *.py | Where-Object { $_.Length -gt 0 }
[System.IO.Path]::Combine($PWD, "build") | Out-Null
ros2 launch my_pkg bringup.launch.py
$null = $files.Count
