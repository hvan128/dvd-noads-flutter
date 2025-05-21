import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

class VideoCardSkeleton extends StatefulWidget {
  const VideoCardSkeleton({super.key});

  @override
  State<VideoCardSkeleton> createState() => _VideoCardSkeletonState();
}

class _VideoCardSkeletonState extends State<VideoCardSkeleton>
    with SingleTickerProviderStateMixin {
  late AnimationController _progressController;
  late Animation<double> _progressAnimation;

  @override
  void initState() {
    super.initState();
    
    // Initialize animation controller for progress indicator
    _progressController = AnimationController(
      duration: const Duration(milliseconds: 1500), // Animation runs for 3 seconds
      vsync: this,
    );

    // Create animation that goes from 0 to 0.28 (28%)
    _progressAnimation = Tween<double>(begin: 0.0, end: 0.28).animate(
      CurvedAnimation(
        parent: _progressController,
        curve: Curves.easeInOut,
      ),
    );

    // Start the animation
    _progressController.forward();
  }

  @override
  void dispose() {
    _progressController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 200,
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          children: [
            // Background shimmer
            Positioned.fill(
              child: Shimmer.fromColors(
                baseColor: const Color(0xFF3E4C59), // xanh đậm
                highlightColor: const Color(0xFF4C9AFF).withOpacity(0.6), // xanh sáng
                child: Container(
                  color: Colors.grey, // will be overridden by shimmer
                ),
              ),
            ),

            // Left-side info shimmer blocks
            Positioned(
              left: 16,
              top: 16,
              bottom: 16,
              right: 100,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Title
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _skeletonBox(width: 120, height: 16),
                      const SizedBox(height: 8),
                      _skeletonBox(width: double.infinity, height: 12),
                      const SizedBox(height: 6),
                      _skeletonBox(width: double.infinity, height: 12),
                      const SizedBox(height: 6),
                      _skeletonBox(width: 160, height: 12),
                    ],
                  ),
                  AnimatedBuilder(
                      animation: _progressAnimation,
                      builder: (context, child) {
                        final int percentage = (_progressAnimation.value * 100).toInt();
                        return Container(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Text(
                              'Đang tải... $percentage%',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          );
                      },
                    ),

                  // Buttons row
                  Row(
                    children: [
                      _skeletonCircle(size: 28),
                      const SizedBox(width: 16),
                      _skeletonCircle(size: 28),
                    ],
                  ),
                ],
              ),
            ),

            // Download progress placeholder with animation
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Progress bar
                  AnimatedBuilder(
                    animation: _progressAnimation,
                    builder: (context, child) {
                      return Stack(
                        children: [
                          // Background bar
                          Container(
                            height: 5,
                            color: Colors.white.withOpacity(0.1),
                          ),
                          // Progress bar
                          FractionallySizedBox(
                            widthFactor: _progressAnimation.value,
                            child: Container(
                              height: 5,
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    Colors.lightBlue.shade300,
                                    Colors.blue.shade500,
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Rectangular shimmer block
  Widget _skeletonBox({required double width, required double height}) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.3),
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }

  // Circular shimmer block (for icons)
  Widget _skeletonCircle({required double size}) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withOpacity(0.3),
      ),
    );
  }
}