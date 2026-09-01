Pod::Spec.new do |s|
  s.name         = "AwakeEventCollector"
  s.version      = "0.0.1"
  s.summary      = "Human Agency OS — iOS native Event Collector (Step 1). Observes OS signals, forwards RawNativeEvents. No network."
  s.homepage     = "https://example.invalid/awake-os"
  s.license      = { :type => "UNLICENSED" }
  s.author       = { "AWAKE OS" => "chanhkien1001@gmail.com" }
  s.platform     = :ios, "15.0"
  s.source       = { :path => "." }
  s.source_files = "AwakeEventCollector/**/*.{swift,h,m}"
  s.dependency "React-Core"
  s.frameworks   = "UIKit", "CryptoKit", "Security"
end
